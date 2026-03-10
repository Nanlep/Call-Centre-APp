import React, { useState } from 'react';
import { Campaign, api } from './services';
import { Megaphone, Save, X, Edit3, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Campaigns = ({ campaigns, onUpdate, onDialCampaign }: { campaigns: Campaign[], onUpdate: () => void, onDialCampaign: (campaign: Campaign) => void }) => {
  const [editingScript, setEditingScript] = useState<number | null>(null);
  const [scriptContent, setScriptContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'outbound' as 'inbound' | 'outbound' });
  const [isCreating, setIsCreating] = useState(false);

  const handleEditScript = (campaign: Campaign) => {
    setEditingScript(campaign.id);
    setScriptContent(campaign.script || '');
  };

  const handleSaveScript = async (id: number) => {
    setIsSaving(true);
    try {
      await api.updateCampaign(id, { script: scriptContent });
      toast.success('Campaign script updated successfully');
      setEditingScript(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update script');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name) return;
    
    setIsCreating(true);
    try {
      await api.createCampaign(newCampaign);
      toast.success('Campaign created successfully');
      setShowCreateModal(false);
      setNewCampaign({ name: '', type: 'outbound' });
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await api.deleteCampaign(id);
      toast.success('Campaign deleted successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete campaign');
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-100 mb-2 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-indigo-500" />
            Campaigns & Scripts
          </h1>
          <p className="text-zinc-400">Manage your active campaigns and their calling scripts.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {campaigns.map(camp => (
          <div key={camp.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-medium text-zinc-100 mb-1">{camp.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${camp.type === 'inbound' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {camp.type.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${camp.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                    {camp.status}
                  </span>
                </div>
              </div>
              {editingScript !== camp.id && (
                <div className="flex items-center gap-2">
                  {camp.type === 'outbound' && (
                    <button
                      onClick={() => onDialCampaign(camp)}
                      className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center gap-2 text-sm"
                      title="Start Auto Dialer"
                    >
                      <Megaphone className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleEditScript(camp)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center gap-2 text-sm"
                    title="Edit Script"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2 text-sm"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              {editingScript === camp.id ? (
                <div className="flex flex-col h-full">
                  <label className="text-sm font-medium text-zinc-400 mb-2">Campaign Script</label>
                  <textarea
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    placeholder="Enter the script for agents to read..."
                    className="w-full h-48 bg-black border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
                  />
                  <div className="flex justify-end gap-3 mt-auto">
                    <button 
                      onClick={() => setEditingScript(null)}
                      className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleSaveScript(camp.id)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Save className="w-4 h-4" /> Save Script
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-3 uppercase tracking-wider">Current Script</h4>
                  {camp.script ? (
                    <div className="bg-black/50 border border-zinc-800/50 rounded-xl p-4 text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {camp.script}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-black/20 border border-dashed border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-sm mb-3">No script added yet.</p>
                      <button 
                        onClick={() => handleEditScript(camp)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                      >
                        + Add Campaign Script
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Create New Campaign</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Q3 Sales Outreach"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Campaign Type</label>
                <select
                  value={newCampaign.type}
                  onChange={e => setNewCampaign({...newCampaign, type: e.target.value as 'inbound' | 'outbound'})}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="outbound">Outbound (Auto Dialer)</option>
                  <option value="inbound">Inbound (Support/Sales)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
