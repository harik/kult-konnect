import React, { useState } from 'react';
import { UserProfile, Gender } from '@/types';
import { db } from '@/core/storage/db';
import { UserCheck, Sparkles } from 'lucide-react';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onProfileCreated: (profile: UserProfile) => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  onProfileCreated,
}) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthDate, setBirthDate] = useState('1995-01-01');
  const [heightCm, setHeightCm] = useState(175);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(70);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [feet, setFeet] = useState(5);
  const [inches, setInches] = useState(9);

  if (!isOpen) return null;

  const handleFeetInchesChange = (newFeet: number, newInches: number) => {
    setFeet(newFeet);
    setInches(newInches);
    const cm = Math.round((newFeet * 12 + newInches) * 2.54);
    setHeightCm(cm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProfile: UserProfile = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      gender,
      birthDate,
      heightCm: Number(heightCm),
      targetWeightKg: targetWeightKg ? Number(targetWeightKg) : undefined,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Remove any dummy unconfigured profiles
    await db.profiles.where('id').equals('default-profile').delete();
    await db.profiles.add(newProfile);
    localStorage.setItem('kult_has_configured_profile', 'true');
    onProfileCreated(newProfile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-brand-500/10 text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-brand-500/20 shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Welcome to Kult Konnect</h2>
          <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
            Your Cult Smart Scale Pro measures clinical 8-electrode bioimpedance. We need your height, age, and sex to calculate accurate Body Fat % and muscle mass.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hari"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Biological Sex
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">Used in BIA equations</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">For metabolic age & BMR</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Height
              </label>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setHeightUnit('cm')}
                  className={`px-2 py-0.5 rounded-md ${heightUnit === 'cm' ? 'bg-brand-500 text-white font-semibold' : 'text-slate-400'}`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit('ft')}
                  className={`px-2 py-0.5 rounded-md ${heightUnit === 'ft' ? 'bg-brand-500 text-white font-semibold' : 'text-slate-400'}`}
                >
                  ft / in
                </button>
              </div>
            </div>

            {heightUnit === 'cm' ? (
              <div className="relative">
                <input
                  type="number"
                  required
                  min={100}
                  max={240}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-medium">cm</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min={3}
                    max={7}
                    value={feet}
                    onChange={(e) => handleFeetInchesChange(Number(e.target.value), inches)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-500">ft</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={inches}
                    onChange={(e) => handleFeetInchesChange(feet, Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-500">in</span>
                </div>
              </div>
            )}
            <span className="text-[10px] text-slate-500 mt-1 block">
              Current: {heightCm} cm — Critical for bioimpedance resistance index (Height²/Impedance)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Target Weight (Optional)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 70"
                value={targetWeightKg || ''}
                onChange={(e) => setTargetWeightKg(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
              <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-medium">kg</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-brand-500/25 transition flex items-center justify-center gap-2 text-sm"
          >
            <UserCheck className="w-5 h-5" /> Start Tracking
          </button>
        </form>
      </div>
    </div>
  );
};
