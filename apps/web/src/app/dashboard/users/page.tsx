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
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });

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
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your agents and their access roles</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 py-2.5 px-4"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Users Table */}
      <div className="card flex-1 overflow-hidden flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter by name or email..." 
              className="input-field pl-9 py-2 text-xs w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total Members:</span>
            <span className="text-xs font-bold text-slate-900">{users.length}</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
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
                {users.map((user, idx) => (
                  <motion.tr 
                    key={user._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-100 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-orange-500/10">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        user.role === 'admin' ? 'bg-rose-500/10 text-rose-400' : 'bg-orange-500/10 text-orange-500'
                      )}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-green-500 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
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
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-2">Add Team Member</h2>
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
                    className="btn-secondary flex-1 py-3"
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
