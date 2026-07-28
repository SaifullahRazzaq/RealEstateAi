'use client';

import { apiFetch, ApiRequestError } from '@/lib/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, Lock, User, Briefcase, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        anonymous: true,
        body: formData,
      });
      toast.success('Account created! Please sign in.');
      router.push('/auth/login');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(249,98,42,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(249,98,42,0.08) 0%, transparent 60%), #f4f5f7' }}>
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'linear-gradient(rgba(16,24,40,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,24,40,0.05) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-blue mb-4 shadow-lg shadow-orange-500/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Get Started</h1>
          <p className="text-slate-400 mt-1 text-sm">Create your free CRM workspace</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Create your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Your Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input id="reg-name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="John Smith" required className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Company Name</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input id="reg-company" name="companyName" type="text" value={formData.companyName} onChange={handleChange} placeholder="Acme Real Estate" required className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input id="reg-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@company.com" required className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input id="reg-password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="Min 8 characters" required minLength={8} className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button id="reg-submit" type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</span>
              ) : (
                <span className="flex items-center gap-2">Create Account <ArrowRight className="w-4 h-4" /></span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
