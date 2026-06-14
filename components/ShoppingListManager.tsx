'use client'

import { useState, useTransition } from 'react'
import type { ShoppingListItem, SourcingCandidate } from '@/lib/types'
import type { Json } from '@/supabase/types'
import { createList, deleteList, upsertListItems } from '@/app/actions/lists'
import { runSourcing } from '@/app/actions/sourcing'
import SourcingResults from './SourcingResults'

type ListRow = { id: string; name: string; items: Json }
type CutOption = { id: string; name_en: string; name_he: string }

type Step =
  | { type: 'idle' }
  | { type: 'geocoding' }
  | { type: 'locating' }
  | { type: 'scoring' }
  | { type: 'results'; candidates: SourcingCandidate[] }
  | { type: 'error'; message: string }

type UserLocation = { lat: number; lng: number; label: string } | null

const RADIUS_OPTIONS = [10, 25, 50, 100] as const

function parseItems(raw: Json): ShoppingListItem[] {
  if (!Array.isArray(raw)) return []
  return (raw as ShoppingListItem[]).filter(
    i => i && typeof i.cut_id === 'string' && typeof i.kg === 'number' && i.kg > 0,
  )
}

export default function ShoppingListManager({
  lists: initialLists,
  cuts,
}: {
  lists: ListRow[]
  cuts: CutOption[]
}) {
  const [lists, setLists] = useState(initialLists)
  const [activeListId, setActiveListId] = useState<string | null>(initialLists[0]?.id ?? null)
  const [draftItems, setDraftItems] = useState<ShoppingListItem[]>(
    parseItems(initialLists[0]?.items ?? []),
  )
  const [radiusKm, setRadiusKm] = useState(25)
  const [step, setStep] = useState<Step>({ type: 'idle' })
  const [userLocation, setUserLocation] = useState<UserLocation>(null)
  const [addressInput, setAddressInput] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isNewListOpen, setIsNewListOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [, startTransition] = useTransition()

  const activeList = lists.find(l => l.id === activeListId) ?? null

  // ── List management ──────────────────────────────────────────────────────────

  function switchList(listId: string) {
    if (activeListId === listId) return
    const savedItems = parseItems(lists.find(l => l.id === activeListId)?.items ?? [])
    const hasUnsaved = JSON.stringify(draftItems) !== JSON.stringify(savedItems)
    if (hasUnsaved && !window.confirm('You have unsaved changes. Discard and switch list?')) return
    setActiveListId(listId)
    setDraftItems(parseItems(lists.find(l => l.id === listId)?.items ?? []))
    setStep({ type: 'idle' })
  }

  function handleCreateList() {
    const name = newListName.trim()
    if (!name) return
    startTransition(async () => {
      const result = await createList(name)
      if ('error' in result) {
        alert(result.error)
        return
      }
      const newList: ListRow = { id: result.id, name, items: [] }
      setLists(prev => [...prev, newList])
      setActiveListId(result.id)
      setDraftItems([])
      setIsNewListOpen(false)
      setNewListName('')
      setStep({ type: 'idle' })
    })
  }

  function handleDeleteList() {
    if (!activeListId || !window.confirm('Delete this list?')) return
    const listId = activeListId
    startTransition(async () => {
      const result = await deleteList(listId)
      if ('error' in result) {
        alert(result.error)
        return
      }
      const newLists = lists.filter(l => l.id !== listId)
      setLists(newLists)
      setActiveListId(newLists[0]?.id ?? null)
      setDraftItems(parseItems(newLists[0]?.items ?? []))
      setStep({ type: 'idle' })
    })
  }

  function handleSaveList() {
    if (!activeListId) return
    const toSave = draftItems.filter(i => i.cut_id && i.kg > 0)
    startTransition(async () => {
      const result = await upsertListItems(activeListId, toSave)
      if ('error' in result) {
        alert(result.error)
        return
      }
      // Sync local state so "unsaved" check passes next time
      setLists(prev =>
        prev.map(l => (l.id === activeListId ? { ...l, items: toSave as unknown as Json } : l)),
      )
    })
  }

  // ── Item editing ─────────────────────────────────────────────────────────────

  function handleAddItem() {
    setDraftItems(prev => [...prev, { cut_id: '', kg: 1 }])
  }

  function handleUpdateItem(idx: number, patch: Partial<ShoppingListItem>) {
    setDraftItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  function handleRemoveItem(idx: number) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Location resolution ──────────────────────────────────────────────────────

  async function handleGeocode() {
    if (!addressInput.trim()) return
    setLocationError(null)
    setStep({ type: 'geocoding' })
    try {
      const q = encodeURIComponent(`${addressInput.trim()}, Israel`)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { 'User-Agent': 'BasarIQ/1.0' } },
      )
      const data = await res.json()
      if (!data || data.length === 0) {
        setLocationError('City not found — try a different name')
        setStep({ type: 'idle' })
        return
      }
      const { lat, lon, display_name } = data[0] as {
        lat: string
        lon: string
        display_name: string
      }
      const label = display_name.split(',')[0]
      setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lon), label })
      setStep({ type: 'idle' })
    } catch {
      setLocationError('Geocoding failed — check your connection')
      setStep({ type: 'idle' })
    }
  }

  function handleGPS() {
    setLocationError(null)
    setStep({ type: 'locating' })
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Current location',
        })
        setStep({ type: 'idle' })
      },
      () => {
        setLocationError('Location access denied — please enter a city instead.')
        setStep({ type: 'idle' })
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── Sourcing ─────────────────────────────────────────────────────────────────

  function handleFindBestStore() {
    if (!userLocation) return
    const validItems = draftItems.filter(i => i.cut_id && i.kg > 0)
    if (validItems.length === 0) return
    setStep({ type: 'scoring' })
    startTransition(async () => {
      const result = await runSourcing({
        items: validItems,
        userLat: userLocation.lat,
        userLng: userLocation.lng,
        radiusKm,
      })
      if ('error' in result) {
        setStep({ type: 'error', message: result.error })
      } else {
        setStep({ type: 'results', candidates: result.candidates })
      }
    })
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const isLoading =
    step.type === 'geocoding' || step.type === 'locating' || step.type === 'scoring'
  const validDraftItems = draftItems.filter(i => i.cut_id && i.kg > 0)
  const canFindStore = !!userLocation && validDraftItems.length > 0 && !isLoading

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shopping lists</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Build a list, then find the best vendor for your whole order
        </p>
      </div>

      {/* List tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {lists.map(list => (
          <button
            key={list.id}
            onClick={() => switchList(list.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              list.id === activeListId
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {list.name}
          </button>
        ))}

        {isNewListOpen ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateList()
                if (e.key === 'Escape') {
                  setIsNewListOpen(false)
                  setNewListName('')
                }
              }}
              placeholder="List name…"
              className="border rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={handleCreateList}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsNewListOpen(false)
                setNewListName('')
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsNewListOpen(true)}
            className="px-3 py-1.5 rounded-full text-sm border border-dashed text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
          >
            + New list
          </button>
        )}
      </div>

      {/* Empty state (no lists) */}
      {lists.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Create a list to get started
        </div>
      )}

      {/* Active list content */}
      {activeList && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Item editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{activeList.name}</h2>
              <button
                onClick={handleDeleteList}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Delete list
              </button>
            </div>

            {draftItems.length === 0 ? (
              <div className="bg-white border rounded-xl p-6 text-center text-gray-400 text-sm">
                No items yet — add a cut below
              </div>
            ) : (
              <div className="space-y-2">
                {draftItems.map((item, idx) => (
                  <div key={idx} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                    <select
                      dir="auto"
                      className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={item.cut_id}
                      onChange={e => handleUpdateItem(idx, { cut_id: e.target.value })}
                    >
                      <option value="">— pick a cut —</option>
                      {cuts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name_en} / {c.name_he}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={item.kg || ''}
                        onChange={e =>
                          handleUpdateItem(idx, { kg: parseFloat(e.target.value) || 0 })
                        }
                        className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">kg</span>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      aria-label="Remove item"
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddItem}
                className="flex-1 px-4 py-2 border border-dashed rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
              >
                + Add item
              </button>
              <button
                onClick={handleSaveList}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Save list
              </button>
            </div>
          </div>

          {/* Right: Sourcing controls */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Find best store</h2>

            {/* Location input */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Your location</label>

              {userLocation ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">📍 {userLocation.label}</span>
                  <button
                    onClick={() => setUserLocation(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={e => setAddressInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleGeocode()
                      }}
                      placeholder="City or address…"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={handleGeocode}
                      disabled={isLoading || !addressInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      Search
                    </button>
                  </div>
                  <button
                    onClick={handleGPS}
                    disabled={isLoading}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors"
                  >
                    📡 Use my current location
                  </button>
                  {locationError && (
                    <p className="text-xs text-red-600">{locationError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Pickup radius */}
            <div className="bg-white border rounded-xl p-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Pickup radius</label>
              <div className="flex gap-2">
                {RADIUS_OPTIONS.map(km => (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      radiusKm === km
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>

            {/* Loading / error feedback */}
            {isLoading && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                {step.type === 'geocoding' && 'Looking up location…'}
                {step.type === 'locating' && 'Getting your location…'}
                {step.type === 'scoring' && 'Finding best store…'}
              </div>
            )}

            {step.type === 'error' && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
                <p className="text-sm text-red-700">{step.message}</p>
                <button
                  onClick={() => setStep({ type: 'idle' })}
                  className="text-xs text-red-600 underline"
                >
                  Try again
                </button>
              </div>
            )}

            <button
              onClick={handleFindBestStore}
              disabled={!canFindStore}
              className="w-full px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🛒 Find best store
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {step.type === 'results' && (
        <SourcingResults
          candidates={step.candidates}
          onBack={() => setStep({ type: 'idle' })}
        />
      )}
    </div>
  )
}
