import React, { useState } from 'react';
import { UserProfile, Gender } from '@/types';
import { db } from '@/core/storage/db';
import { X, UserPlus, Check, User, Trash2 } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  currentProfile: UserProfile;
  onProfileSelect: (profile: UserProfile) => void;
  onProfilesChanged: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profiles,
  currentProfile,
  onProfileSelect,
  onProfilesChanged,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthDate, setBirthDate] = useState('1995-01-01');
  const [heightCm, setHeightCm] = useState(175);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(70);

  if (!isOpen) return null;

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProfile: UserProfile = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      gender,
      birthDate,
      heightCm: Number(heightCm),
      targetWeightKg: targetWeightKg ? Number(targetWeightKg) : undefined,
      isDefault: profiles.length === 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.profiles.add(newProfile);
    setIsAdding(false);
    setName('');
    onProfilesChanged();
    onProfileSelect(newProfile);
  };

  const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      alert('You must have at least one profile.');
      return;
    }
    if (confirm('Delete this profile and its measurement history?')) {
      await db.profiles.delete(id);
      await db.measurements.where('profileId').equals(id).delete();
      onProfilesChanged();
      if (currentProfile.id === id) {
        const remaining = profiles.filter(p => p.id !== id);
        if (remaining.length > 0) onProfileSelect(remaining[0]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-brand-400" /> Household Profiles
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Profiles List */}
        {!isAdding && (
          <div className="flex flex-col gap-2.5 my-2">
            {profiles.map((p) => {
              const isSelected = p.id === currentProfile.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onProfileSelect(p);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/40 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isSelected ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        {p.name}
                        {p.isDefault && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Default</span>}
                      </div>
                      <div className="text-xs text-slate-500 capitalize">
                        {p.gender} • {p.heightCm} cm • Born {p.birthDate.slice(0, 4)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isSelected && <Check className="w-5 h-5 text-brand-400 mr-1" />}
                    {profiles.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteProfile(p.id, e)}
                        className="p-1.5 text-slate-600 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setIsAdding(true)}
              className="mt-3 w-full py-3 border border-dashed border-slate-700 hover:border-brand-500 text-slate-400 hover:text-brand-400 font-medium rounded-2xl flex items-center justify-center gap-2 text-sm transition"
            >
              <UserPlus className="w-4 h-4" /> Add Member Profile
            </button>
          </div>
        )}

        {/* Add Profile Form */}
        {isAdding && (
          <form onSubmit={handleCreateProfile} className="flex flex-col gap-3 my-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Birth Date</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  required
                  min={100}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={targetWeightKg || ''}
                  onChange={(e) => setTargetWeightKg(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Optional"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-md shadow-brand-500/20"
              >
                Save Profile
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
