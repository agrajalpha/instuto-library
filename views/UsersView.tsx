
import React, { useState, useEffect } from 'react';
import { SystemUser, SystemRole } from '../types';
import { db } from '../services/storage';
import { Card, Button, Input, Select, Badge, Modal } from '../components/Shared';
import { Plus, Trash2, Edit2, Shield, User, Mail, Lock, Ban, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

interface UsersViewProps {
  onNotify: (msg: string, type: 'success' | 'error') => void;
  currentUser: SystemUser;
}

export const UsersView: React.FC<UsersViewProps> = ({ onNotify, currentUser }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  
  const [formData, setFormData] = useState<Partial<SystemUser>>({
    role: SystemRole.LIBRARIAN
  });

  useEffect(() => {
    refreshUsers();
  }, []);

  const refreshUsers = async () => {
    setLoading(true);
    try {
        const data = await db.getSystemUsers();
        setUsers(data);
    } catch (e) {
        onNotify("Failed to load users", "error");
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.role) {
      onNotify('Please fill all fields', 'error');
      return;
    }

    const user: SystemUser = {
      id: editingUser ? editingUser.id : crypto.randomUUID(), // Backend will handle ID/password if null
      name: formData.name,
      email: formData.email,
      role: formData.role as SystemRole,
      isActive: editingUser ? editingUser.isActive : true,
    };

    try {
        await db.saveSystemUser(user);
        onNotify(editingUser ? 'User updated' : 'User created', 'success');
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ role: SystemRole.LIBRARIAN });
        refreshUsers();
    } catch (e) {
        onNotify("Failed to save user", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser.id) {
        onNotify("You cannot delete yourself", "error");
        return;
    }
    if (confirm('Delete this user?')) {
      try {
        await db.deleteSystemUser(id);
        onNotify('User deleted', 'success');
        refreshUsers();
      } catch (e) {
        onNotify("Failed to delete user", "error");
      }
    }
  };

  const handleResetPassword = async (id: string) => {
      if (confirm('Reset password to default?')) {
          try {
            await db.resetUserPassword(id);
            onNotify('Password reset successfully', 'success');
          } catch (e) {
            onNotify("Failed to reset password", "error");
          }
      }
  };

  const handleToggleStatus = async (id: string) => {
      if (id === currentUser.id) {
          onNotify("You cannot disable your own account", "error");
          return;
      }
      try {
        await db.toggleUserStatus(id);
        refreshUsers();
        onNotify('User status updated', 'success');
      } catch (e) {
        onNotify("Failed to toggle status", "error");
      }
  };

  const openModal = (user?: SystemUser) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({ role: SystemRole.LIBRARIAN });
    }
    setIsModalOpen(true);
  };
  
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">System Users</h2>
           <p className="text-slate-500 text-sm">Manage staff access and roles</p>
        </div>
        <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden border border-slate-200 shadow-sm flex flex-col">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                    <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                    <User size={16} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        {user.name}
                                        {user.id === currentUser.id && <Badge color="blue">You</Badge>}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">Last Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500">{user.email}</td>
                            <td className="px-6 py-4">
                                <Badge color={user.role === SystemRole.ADMIN ? 'purple' : 'gray'}>
                                    {user.role}
                                </Badge>
                            </td>
                            <td className="px-6 py-4">
                                {user.isActive ? (
                                    <span className="text-green-600 flex items-center gap-1 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">
                                        <CheckCircle size={12} /> Active
                                    </span>
                                ) : (
                                    <span className="text-red-600 flex items-center gap-1 text-xs font-medium bg-red-50 px-2 py-0.5 rounded-full w-fit">
                                        <Ban size={12} /> Disabled
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleToggleStatus(user.id)} 
                                        className={`p-2 rounded transition-colors ${user.isActive ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-green-600 hover:bg-green-50'}`}
                                        title={user.isActive ? "Disable User" : "Activate User"}
                                    >
                                        {user.isActive ? <Ban size={16} /> : <CheckCircle size={16} />}
                                    </button>
                                    <button 
                                        onClick={() => handleResetPassword(user.id)} 
                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                        title="Reset Password"
                                    >
                                        <RefreshCw size={16} />
                                    </button>
                                    <button 
                                        onClick={() => openModal(user)} 
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit User"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(user.id)} 
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        footer={
            <>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save User</Button>
            </>
        }
      >
        <div className="space-y-4">
            <Input 
                label="Full Name" 
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Jane Doe"
            />
            <Input 
                label="Email Address" 
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="jane@library.edu"
            />
            <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as SystemRole})}
                >
                    <option value={SystemRole.LIBRARIAN}>Librarian</option>
                    <option value={SystemRole.ADMIN}>Administrator</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    Administrators have access to Settings and User Management.
                </p>
            </div>
            
            {!editingUser && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex gap-2 items-start">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>New users will be created with the default password: <strong>password</strong>. They can change it after logging in.</p>
                </div>
            )}
        </div>
      </Modal>
    </div>
  );
};
