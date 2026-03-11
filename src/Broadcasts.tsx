import React, { useState } from 'react';
import { Radio, Send, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const Broadcasts = () => {
  const [prefix, setPrefix] = useState('+1415555');
  const [count, setCount] = useState(10);
  const [message, setMessage] = useState('Hello! This is a broadcast message from our team.');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefix || !count || !message) return;
    
    if (!confirm(`Are you sure you want to send this WhatsApp message to ${count} generated numbers starting with ${prefix}?`)) {
      return;
    }

    setIsBroadcasting(true);
    setResults([]);
    
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prefix, count, body: message })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run broadcast');
      
      setResults(data.results || []);
      toast.success(`Broadcast completed. Sent to ${data.results?.length || 0} numbers.`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to run broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-100 mb-2 flex items-center gap-3">
          <Radio className="w-8 h-8 text-emerald-500" />
          WhatsApp Broadcast
        </h1>
        <p className="text-zinc-400">Generate phone numbers and send a WhatsApp broadcast message.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-medium text-white mb-6">Broadcast Settings</h2>
          
          <form onSubmit={handleBroadcast} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Phone Number Prefix</label>
              <input
                type="text"
                required
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. +1415555"
              />
              <p className="text-xs text-zinc-500 mt-2">We will append a 4-digit sequential number to this prefix.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Number of Contacts to Generate</label>
              <input
                type="number"
                required
                min="1"
                max="250"
                value={count}
                onChange={e => setCount(parseInt(e.target.value) || 0)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-xs text-zinc-500 mt-2">Maximum 250 per broadcast to ensure reliable delivery.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">WhatsApp Message</label>
              <textarea
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                placeholder="Enter your broadcast message..."
              />
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-sm text-amber-500/90">
                <strong>Warning:</strong> Broadcasting to generated numbers may result in your Twilio/WhatsApp account being flagged for spam. Use responsibly and ensure you comply with WhatsApp's terms of service.
              </div>
            </div>

            <button
              type="submit"
              disabled={isBroadcasting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isBroadcasting ? (
                'Broadcasting...'
              ) : (
                <>
                  <Send className="w-5 h-5" /> Run Broadcast
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" />
            Broadcast Results
          </h2>
          
          <div className="flex-1 overflow-y-auto bg-black rounded-xl border border-zinc-800 p-4">
            {results.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Results will appear here after the broadcast completes.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((res, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <span className="text-zinc-300 font-mono text-sm">{res.phone}</span>
                    {res.status === 'sent' ? (
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded">Sent</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-medium rounded" title={res.error}>Failed</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
