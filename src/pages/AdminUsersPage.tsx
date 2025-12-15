import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, ShieldAlert, Award, AlertTriangle, X } from 'lucide-react';
import { TRUST_RANKS } from '../constants/masterData';
import { type User } from '../types';

export const AdminUsersPage = () => {
  const { allUsers, currentUser, isAuthenticated, updateUserRole } = useApp();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [isUpdating, setIsUpdating] = useState(false);

  // Check Admin Role
  if (!isAuthenticated || currentUser.role !== 'admin') {
    return <div className="p-10 text-center text-gray-500">Access Denied. Admins only.</div>;
  }

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    if (!window.confirm(`Are you sure you want to change ${editingUser.name}'s role to ${selectedRole}?`)) return;

    setIsUpdating(true);
    try {
      await updateUserRole(editingUser.id, selectedRole);
      alert('User role updated successfully.');
      setEditingUser(null);
    } catch (e) {
      console.error(e);
      alert('Failed to update role.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Sort users: Admins first, then Mods, then by Trust Score high->low
  const sortedUsers = [...allUsers].sort((a, b) => {
    const roleOrder = { admin: 3, moderator: 2, user: 1 };
    const roleDiff = roleOrder[b.role] - roleOrder[a.role];
    if (roleDiff !== 0) return roleDiff;
    return (b.trustScore || 0) - (a.trustScore || 0);
  });

  const getRankBadge = (score: number) => {
    const rank = TRUST_RANKS.slice().reverse().find(r => score >= r.minScore) || TRUST_RANKS[0];
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">
        <Award size={12} className={rank.designColor} />
        {rank.name}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-indigo-600" /> User Management
          </h1>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm text-gray-500">
            Total Users: {allUsers.length}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Trust Rank</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUsers.map(user => (
                <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                        {user.profileImage ? (
                          <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-400">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {getRankBadge(user.trustScore || 0)}
                      <span className="text-xs text-gray-400 ml-1">Score: {user.trustScore || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEditClick(user)}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                      disabled={currentUser.id === user.id} // Cannot edit own role
                    >
                      Edit Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit User Role</h2>
                <p className="text-sm text-gray-500">Change permissions for {editingUser.name}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-3">
                <label className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedRole === 'user' ? 'border-gray-600 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg"><Award size={18} className="text-gray-600" /></div>
                    <div>
                      <div className="font-semibold text-gray-900">User</div>
                      <div className="text-xs text-gray-500">Regular user. Can submit proposals.</div>
                    </div>
                  </div>
                  <input type="radio" name="role" checked={selectedRole === 'user'} onChange={() => setSelectedRole('user')} className="w-5 h-5 text-gray-600" />
                </label>

                <label className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedRole === 'moderator' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Shield size={18} className="text-blue-600" /></div>
                    <div>
                      <div className="font-semibold text-gray-900">Moderator</div>
                      <div className="text-xs text-gray-500">Can approve/reject proposals.</div>
                    </div>
                  </div>
                  <input type="radio" name="role" checked={selectedRole === 'moderator'} onChange={() => setSelectedRole('moderator')} className="w-5 h-5 text-blue-600" />
                </label>

                <label className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedRole === 'admin' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg"><ShieldAlert size={18} className="text-purple-600" /></div>
                    <div>
                      <div className="font-semibold text-gray-900">Admin</div>
                      <div className="text-xs text-gray-500">Full access to all settings.</div>
                    </div>
                  </div>
                  <input type="radio" name="role" checked={selectedRole === 'admin'} onChange={() => setSelectedRole('admin')} className="w-5 h-5 text-purple-600" />
                </label>
              </div>

              {selectedRole === 'admin' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-lg">
                  <AlertTriangle size={14} className="mt-0.5" />
                  <span>Caution: Admin role grants full system control including deletion rights.</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
