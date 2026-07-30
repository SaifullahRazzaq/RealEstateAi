'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from 'react';
import { 
  Users, UserPlus, Shield, Mail, Trash2, Loader2, 
  Search, CheckCircle2, XCircle, MoreVertical 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });

  // The filter box was rendered but never wired up; the list is small enough
  // that matching in the browser is the whole feature.
  const query = filter.trim().toLowerCase();
  const visible = query
    ? users.filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    : users;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>('/api/users');
      setUsers(data.users || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch<{ user: User }>('/api/users', {
        method: 'POST',
        body: newUser,
      });
      toast.success('User added successfully');
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'agent' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Team Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage your agents and their access roles</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center justify-center gap-2 py-3 sm:py-2.5 px-4 w-full sm:w-auto flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Users */}
      <div className="card flex-1 lg:overflow-hidden flex flex-col shadow-xl">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or email..."
              className="input-field pl-9 py-2 text-xs w-full"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500">Total Members:</span>
            <span className="text-xs font-bold text-slate-900">{visible.length}</span>
          </div>
        </div>

        <div className="lg:overflow-y-auto lg:flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-slate-400">No team members match that filter</p>
          ) : (
            <>
            {/* Phones get stacked cards — five columns of a table cannot be read
                at 360px, and a sideways scroll for identity data is worse. */}
            <div className="divide-y divide-slate-200 md:hidden">
              {visible.map((user, idx) => (
                <motion.div
                  key={user._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="px-4 py-4 flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-orange-500/10 flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        user.role === 'admin' ? 'bg-rose-500/10 text-rose-500' : 'bg-orange-500/10 text-orange-500'
                      )}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                      <span className="inline-flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <button aria-label="More actions" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all flex-shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>

            <table className="hidden md:table w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visible.map((user, idx) => (
                  <motion.tr
                    key={user._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-100 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-orange-500/10 flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 leading-none truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 mt-1 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        user.role === 'admin' ? 'bg-rose-500/10 text-rose-500' : 'bg-orange-500/10 text-orange-500'
                      )}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-green-500 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button aria-label="More actions" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Add Team Member</h2>
              <p className="text-sm text-slate-500 mb-6">Create a new account for your agent</p>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. John Doe"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Email Address</label>
                  <input 
                    required
                    type="email" 
                    placeholder="e.g. john@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Password</label>
                  <input 
                    required
                    type="password" 
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Access Role</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="input-field"
                  >
                    <option value="agent">Agent (Standard Access)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1 py-3 justify-center"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
