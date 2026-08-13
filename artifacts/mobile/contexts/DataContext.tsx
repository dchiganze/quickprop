import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, Lead, BuyerMatch, Task } from '@/types';

interface DataContextType {
  properties: Property[];
  leads: Lead[];
  buyerMatches: BuyerMatch[];
  tasks: Task[];
  isLoading: boolean;
  addProperty: (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Property>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  addLead: (l: Omit<Lead, 'id' | 'createdAt'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

const PROPS_KEY = '@qp_properties';
const LEADS_KEY = '@qp_leads';
const MATCHES_KEY = '@qp_matches';
const TASKS_KEY = '@qp_tasks';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => new Date().toISOString();

const MOCK_PROPERTIES: Property[] = [
  {
    id: 'prop-001', referenceNumber: 'QP-2024-001', type: 'sale', status: 'published',
    address: '14 Acacia Avenue', suburb: 'Borrowdale', price: 420000, currency: 'USD',
    negotiable: true, bedrooms: 4, bathrooms: 3, garages: 2, landSize: 4200, floorArea: 380,
    levies: 0, rates: 280,
    features: ['Swimming Pool', 'Borehole', 'Solar', 'Electric Fence', 'Generator', 'Fibre'],
    description: 'Exceptional four-bedroom home in the heart of Borrowdale. Double storey with a sun-drenched pool, lush garden and modern finishes throughout. Borehole and solar ensure full independence from municipal services.',
    photos: [], coordinates: { lat: -17.7467, lng: 31.0969 },
    seller: { name: 'Robert Chikwanda', phone: '+263 77 456 7890', email: 'r.chikwanda@mail.com', mandateExpiry: '2025-03-31', mandateType: 'sole', notes: 'Seller is motivated, willing to negotiate on price.' },
    agentId: 'agent-001', createdAt: '2024-11-01T09:00:00Z', updatedAt: '2024-12-15T14:30:00Z',
  },
  {
    id: 'prop-002', referenceNumber: 'QP-2024-002', type: 'sale', status: 'published',
    address: '7 Jacaranda Close', suburb: 'Highlands', price: 350000, currency: 'USD',
    negotiable: false, bedrooms: 3, bathrooms: 2, garages: 2, landSize: 3000, floorArea: 250,
    levies: 0, rates: 220,
    features: ['Solar', 'Electric Fence', 'Alarm System', 'Fitted Kitchen', 'Fibre', 'Municipal Water'],
    description: 'Charming three-bedroom home in sought-after Highlands. Recently renovated with modern kitchen and bathrooms. Excellent security with electric fence and alarm system.',
    photos: [], coordinates: { lat: -17.7850, lng: 31.0650 },
    seller: { name: 'Sarah Moyo', phone: '+263 71 234 5678', email: 's.moyo@gmail.com', mandateExpiry: '2025-02-28', mandateType: 'exclusive', notes: 'Must sell by end of February.' },
    agentId: 'agent-001', createdAt: '2024-11-15T10:00:00Z', updatedAt: '2024-12-10T11:00:00Z',
  },
  {
    id: 'prop-003', referenceNumber: 'QP-2024-003', type: 'sale', status: 'published',
    address: '22 Palm Drive', suburb: 'Greendale', price: 285000, currency: 'USD',
    negotiable: true, bedrooms: 3, bathrooms: 2, garages: 1, landSize: 2500, floorArea: 200,
    levies: 0, rates: 180,
    features: ['Borehole', 'Solar', 'Swimming Pool', 'Garden', 'Paved Driveway'],
    description: 'Well-maintained family home in quiet Greendale cul-de-sac. Features borehole, solar panels and a private pool. Ideal for families seeking a peaceful neighbourhood.',
    photos: [], coordinates: { lat: -17.8050, lng: 31.1100 },
    seller: { name: 'James Dube', phone: '+263 73 987 6543', email: 'j.dube@yahoo.com', mandateExpiry: '2025-04-30', mandateType: 'open', notes: 'Flexible on viewing times.' },
    agentId: 'agent-001', createdAt: '2024-12-01T08:00:00Z', updatedAt: '2024-12-20T09:00:00Z',
  },
  {
    id: 'prop-004', referenceNumber: 'QP-2024-004', type: 'rent', status: 'published',
    address: '5B Mount Pleasant Heights', suburb: 'Mount Pleasant', price: 2200, currency: 'USD',
    negotiable: false, bedrooms: 4, bathrooms: 3, garages: 2, landSize: 0, floorArea: 320,
    features: ['Fully Furnished', 'Swimming Pool', 'Air Conditioning', 'Fibre', 'Generator', 'Solar'],
    description: 'Luxurious furnished apartment in Mount Pleasant Heights. All utilities included. Access to communal pool and gym. Perfect for expats and diplomatic staff.',
    photos: [], coordinates: { lat: -17.7600, lng: 31.0750 },
    seller: { name: 'Michelle Kazingizi', phone: '+263 77 111 2222', email: 'm.k@prime.co.zw', mandateExpiry: '2025-06-30', mandateType: 'exclusive', notes: 'Monthly lease preferred. Security deposit 2 months.' },
    agentId: 'agent-001', createdAt: '2024-10-01T09:00:00Z', updatedAt: '2024-12-05T15:00:00Z',
  },
  {
    id: 'prop-005', referenceNumber: 'QP-2024-005', type: 'commercial', status: 'draft',
    address: '103 Samora Machel Avenue', suburb: 'Avondale', price: 650000, currency: 'USD',
    negotiable: true, bedrooms: 0, bathrooms: 4, garages: 8, landSize: 1200, floorArea: 800,
    features: ['Generator', 'Air Conditioning', 'Fibre', 'Alarm System', 'Paved Driveway', 'Internet'],
    description: 'Prime commercial property on Avondale\'s main commercial strip. Excellent exposure and foot traffic. Currently operating as office space with 12 workstations.',
    photos: [],
    seller: { name: 'Tendai Musariri', phone: '+263 71 555 6666', email: 't.musariri@corp.co.zw', mandateExpiry: '2025-05-31', mandateType: 'sole', notes: 'Needs valuation update. Draft mode.' },
    agentId: 'agent-001', createdAt: '2024-12-10T14:00:00Z', updatedAt: '2024-12-18T16:00:00Z',
  },
  {
    id: 'prop-006', referenceNumber: 'QP-2024-006', type: 'sale', status: 'sold',
    address: '9 Msasa Park Drive', suburb: 'Msasa', price: 195000, currency: 'USD',
    negotiable: false, bedrooms: 3, bathrooms: 2, garages: 1, landSize: 2200, floorArea: 180,
    features: ['Electric Fence', 'Borehole', 'Municipal Water', 'Garden'],
    description: 'Sold! Three-bedroom home in Msasa with borehole and electric fence. Good investment location.',
    photos: [],
    seller: { name: 'Patricia Ncube', phone: '+263 73 444 5555', email: 'p.ncube@mail.com', mandateExpiry: '2024-12-01', mandateType: 'exclusive', notes: 'SOLD - Transfer in progress.' },
    agentId: 'agent-001', createdAt: '2024-09-01T09:00:00Z', updatedAt: '2024-12-12T09:00:00Z',
  },
];

const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-001', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'David Mupfumi', buyerPhone: '+263 77 888 9999', buyerEmail: 'd.mupfumi@email.com',
    stage: 'viewing_booked', notes: 'Very interested. Cash buyer. Wants to view Saturday morning.',
    followUpDate: new Date(Date.now() + 86400000 * 2).toISOString(), createdAt: '2024-12-14T10:00:00Z',
  },
  {
    id: 'lead-002', propertyId: 'prop-002', propertyAddress: '7 Jacaranda Close, Highlands',
    buyerName: 'Grace Chirau', buyerPhone: '+263 71 777 8888', buyerEmail: 'g.chirau@gmail.com',
    stage: 'contacted', notes: 'Diaspora buyer. Financing through Standard Chartered. Needs full documentation.',
    followUpDate: new Date(Date.now() + 86400000).toISOString(), createdAt: '2024-12-16T14:00:00Z',
  },
  {
    id: 'lead-003', propertyId: 'prop-003', propertyAddress: '22 Palm Drive, Greendale',
    buyerName: 'Emmanuel Sithole', buyerPhone: '+263 73 666 7777', buyerEmail: 'e.sithole@corp.com',
    stage: 'offer', notes: 'Offered $270k. Seller counter-offered $280k. Negotiation ongoing.',
    followUpDate: new Date(Date.now() + 86400000 * 3).toISOString(), createdAt: '2024-12-10T09:00:00Z',
  },
  {
    id: 'lead-004', propertyId: 'prop-004', propertyAddress: '5B Mount Pleasant Heights',
    buyerName: 'Amara Okonkwo', buyerPhone: '+263 77 555 4444', buyerEmail: 'a.okonkwo@ngomain.org',
    stage: 'new', notes: 'NGO worker relocating from Zambia. Needs by end of January.',
    createdAt: '2024-12-20T11:00:00Z',
  },
];

const MOCK_MATCHES: BuyerMatch[] = [
  {
    id: 'match-001', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'Thomas Mpofu', matchPercentage: 94, budget: 450000, preferredLocation: 'Borrowdale',
    financeType: 'cash', urgency: 'immediate', preferences: ['4+ bedrooms', 'Pool', 'Solar', 'Borehole'],
    responded: false,
  },
  {
    id: 'match-002', propertyId: 'prop-002', propertyAddress: '7 Jacaranda Close, Highlands',
    buyerName: 'Chido Zvinavashe', matchPercentage: 87, budget: 380000, preferredLocation: 'Highlands',
    financeType: 'diaspora', urgency: 'within_month', preferences: ['3+ bedrooms', 'Modern kitchen', 'Fibre'],
    responded: false,
  },
  {
    id: 'match-003', propertyId: 'prop-003', propertyAddress: '22 Palm Drive, Greendale',
    buyerName: 'Faith Mutasa', matchPercentage: 82, budget: 300000, preferredLocation: 'Greendale',
    financeType: 'mortgage', urgency: 'within_month', preferences: ['Family home', 'Pool', 'Quiet area'],
    responded: true,
  },
  {
    id: 'match-004', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'Victor Chigamba', matchPercentage: 78, budget: 420000, preferredLocation: 'Borrowdale',
    financeType: 'cash', urgency: 'flexible', preferences: ['4 bedrooms', 'Electric fence', 'Generator'],
    responded: false,
  },
];

const MOCK_TASKS: Task[] = [
  {
    id: 'task-001', title: 'Call Robert re: Borrowdale mandate renewal', type: 'call_seller',
    dueDate: new Date().toISOString(), propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue',
    completed: false, createdAt: '2024-12-18T09:00:00Z',
  },
  {
    id: 'task-002', title: 'Viewing with David Mupfumi - 14 Acacia Ave', type: 'viewing',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), propertyId: 'prop-001',
    propertyAddress: '14 Acacia Avenue', completed: false, createdAt: '2024-12-19T10:00:00Z',
  },
  {
    id: 'task-003', title: 'Update price for Greendale listing', type: 'price_update',
    dueDate: new Date().toISOString(), propertyId: 'prop-003', propertyAddress: '22 Palm Drive',
    completed: false, createdAt: '2024-12-20T08:00:00Z',
  },
  {
    id: 'task-004', title: 'Take additional photos - Highlands property', type: 'take_photos',
    dueDate: new Date(Date.now() - 86400000).toISOString(), propertyId: 'prop-002',
    propertyAddress: '7 Jacaranda Close', completed: false, createdAt: '2024-12-15T09:00:00Z',
  },
  {
    id: 'task-005', title: 'Renew sole mandate - Avondale Commercial', type: 'renew_mandate',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(), propertyId: 'prop-005',
    propertyAddress: '103 Samora Machel Ave', completed: false, createdAt: '2024-12-20T11:00:00Z',
  },
];

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [buyerMatches, setBuyerMatches] = useState<BuyerMatch[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ps, ls, ms, ts] = await Promise.all([
          AsyncStorage.getItem(PROPS_KEY),
          AsyncStorage.getItem(LEADS_KEY),
          AsyncStorage.getItem(MATCHES_KEY),
          AsyncStorage.getItem(TASKS_KEY),
        ]);
        setProperties(ps ? JSON.parse(ps) : MOCK_PROPERTIES);
        setLeads(ls ? JSON.parse(ls) : MOCK_LEADS);
        setBuyerMatches(ms ? JSON.parse(ms) : MOCK_MATCHES);
        setTasks(ts ? JSON.parse(ts) : MOCK_TASKS);
        if (!ps) await AsyncStorage.setItem(PROPS_KEY, JSON.stringify(MOCK_PROPERTIES));
        if (!ls) await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(MOCK_LEADS));
        if (!ms) await AsyncStorage.setItem(MATCHES_KEY, JSON.stringify(MOCK_MATCHES));
        if (!ts) await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(MOCK_TASKS));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const save = async (key: string, data: unknown[]) => AsyncStorage.setItem(key, JSON.stringify(data));

  const addProperty = async (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => {
    const prop: Property = { ...p, id: uid(), createdAt: now(), updatedAt: now() };
    const updated = [...properties, prop];
    setProperties(updated);
    await save(PROPS_KEY, updated);
    return prop;
  };

  const updateProperty = async (id: string, updates: Partial<Property>) => {
    const updated = properties.map(p => p.id === id ? { ...p, ...updates, updatedAt: now() } : p);
    setProperties(updated);
    await save(PROPS_KEY, updated);
  };

  const deleteProperty = async (id: string) => {
    const updated = properties.filter(p => p.id !== id);
    setProperties(updated);
    await save(PROPS_KEY, updated);
  };

  const addLead = async (l: Omit<Lead, 'id' | 'createdAt'>) => {
    const lead: Lead = { ...l, id: uid(), createdAt: now() };
    const updated = [...leads, lead];
    setLeads(updated);
    await save(LEADS_KEY, updated);
    return lead;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const updated = leads.map(l => l.id === id ? { ...l, ...updates } : l);
    setLeads(updated);
    await save(LEADS_KEY, updated);
  };

  const addTask = async (t: Omit<Task, 'id' | 'createdAt'>) => {
    const task: Task = { ...t, id: uid(), createdAt: now() };
    const updated = [...tasks, task];
    setTasks(updated);
    await save(TASKS_KEY, updated);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const updated = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setTasks(updated);
    await save(TASKS_KEY, updated);
  };

  const deleteTask = async (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    await save(TASKS_KEY, updated);
  };

  return (
    <DataContext.Provider value={{
      properties, leads, buyerMatches, tasks, isLoading,
      addProperty, updateProperty, deleteProperty,
      addLead, updateLead, addTask, updateTask, deleteTask,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
