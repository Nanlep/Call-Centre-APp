import React, { useState } from 'react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    nairaPrice: '₦45k',
    agents: '1–2',
    minutes: '300',
    features: ['Inbound & outbound calls', 'IVR menu', 'Call logs'],
    extraMinutes: '$0.05/min',
    popular: false,
  },
  {
    name: 'Growth',
    price: '$79',
    nairaPrice: '₦120k',
    agents: 'Up to 5',
    minutes: '1,000',
    features: ['Call recording', 'CRM integration', 'Analytics dashboard'],
    extraMinutes: '$0.04/min',
    popular: true,
  },
  {
    name: 'Business',
    price: '$199',
    nairaPrice: '₦300k',
    agents: 'Up to 20',
    minutes: '3,000',
    features: ['Auto dialer', 'Call queues', 'Supervisor dashboard'],
    extraMinutes: '$0.03/min',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: '$499+',
    nairaPrice: '₦750k+',
    agents: 'Unlimited',
    minutes: '10,000+',
    features: ['AI call summaries', 'Workflow automation', 'API access'],
    extraMinutes: '$0.025/min',
    popular: false,
  },
];

const additionalCharges = [
  { service: 'Phone Number', price: '$3 – $5 / month' },
  { service: 'SMS', price: '$0.02 / message' },
  { service: 'WhatsApp Message', price: '$0.02 – $0.03' },
  { service: 'Additional Storage (Call Recordings)', price: '$10 / month' },
];

export const Pricing = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = (planName: string) => {
    setSelectedPlan(planName);
    // Simulate Interswitch payment modal
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert(`Successfully subscribed to ${planName} plan via Interswitch!`);
      setSelectedPlan(null);
    }, 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Choose the perfect plan for your call center. Scale up as your team grows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {plans.map((plan) => (
          <div 
            key={plan.name} 
            className={`relative bg-zinc-900 rounded-2xl p-6 border ${plan.popular ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-zinc-800'} flex flex-col`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                Most Popular
              </div>
            )}
            
            <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-white">{plan.price}</span>
              <span className="text-zinc-400">/mo</span>
            </div>
            <div className="text-sm text-zinc-500 mb-6">{plan.nairaPrice} / month</div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Agents Included</span>
                <span className="text-white font-medium">{plan.agents}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Minutes Included</span>
                <span className="text-white font-medium">{plan.minutes}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Extra Minutes</span>
                <span className="text-white font-medium">{plan.extraMinutes}</span>
              </div>
              
              <div className="pt-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-3">Key Features</span>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => handleSubscribe(plan.name)}
              disabled={isProcessing}
              className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                plan.popular 
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white'
              }`}
            >
              {isProcessing && selectedPlan === plan.name ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Subscribe with Interswitch
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          Additional Charges
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Service</th>
                <th className="px-6 py-4 rounded-tr-lg">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {additionalCharges.map((charge, i) => (
                <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-200">{charge.service}</td>
                  <td className="px-6 py-4 text-zinc-400">{charge.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
