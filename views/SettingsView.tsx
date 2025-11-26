
import React, { useState, useEffect } from 'react';
import { db } from '../services/storage';
import { SystemSettings, LenderType, ReturnFilterOption } from '../types';
import { Card, Button, Input } from '../components/Shared';
import { ChevronRight, Plus, Trash2, Settings, Edit2, Check, X, Clock, Filter, Loader2 } from 'lucide-react';

interface SettingsViewProps {
  onNotify: (msg: string, type: 'success' | 'error') => void;
}

type SettingKey = keyof SystemSettings;

const SECTIONS = [
  {
    title: 'Master Data',
    items: [
      { key: 'authors' as SettingKey, label: 'Authors' },
      { key: 'publishers' as SettingKey, label: 'Publishers' },
    ]
  },
  {
    title: 'Classification',
    items: [
      { key: 'categories' as SettingKey, label: 'Categories' },
      { key: 'genres' as SettingKey, label: 'Genres' },
    ]
  },
  {
    title: 'Location',
    items: [
      { key: 'racks' as SettingKey, label: 'Racks' },
      { key: 'shelves' as SettingKey, label: 'Shelves' },
    ]
  },
  {
    title: 'Administration',
    items: [
      { key: 'lenderTypes' as SettingKey, label: 'Lender Types & Rules' },
      { key: 'returnFilterOptions' as SettingKey, label: 'Circulation Filters' },
      { key: 'withdrawalReasons' as SettingKey, label: 'Withdrawal Reasons' },
    ]
  }
];

export const SettingsView: React.FC<SettingsViewProps> = ({ onNotify }) => {
  const [activeKey, setActiveKey] = useState<SettingKey>('authors');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  
  // State for numeric values (Lender Duration or Return Filter Days)
  const [newNumberVal, setNewNumberVal] = useState(14);
  
  // Edit State
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Edit State for numeric
  const [editNumberVal, setEditNumberVal] = useState(14);

  const isComplexConfig = activeKey === 'lenderTypes' || activeKey === 'returnFilterOptions';

  useEffect(() => {
    const load = async () => {
        setLoading(true);
        try {
            const data = await db.getSettings();
            setSettings(data);
        } catch (e) {
            onNotify("Failed to load settings", "error");
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (!newValue.trim() || !settings) return;

    if (activeKey === 'lenderTypes') {
       const types = settings.lenderTypes;
       if (types.some(t => t.name === newValue.trim())) {
         onNotify('Lender type already exists', 'error');
         return;
       }
       const updatedSettings = {
         ...settings,
         lenderTypes: [...types, { name: newValue.trim(), duration: newNumberVal }]
       };
       await db.updateSettings(updatedSettings);
       setSettings(updatedSettings);
       setNewValue('');
       setNewNumberVal(14);
       onNotify('Lender type added', 'success');
       return;
    }

    if (activeKey === 'returnFilterOptions') {
        const options = settings.returnFilterOptions;
        if (options.some(o => o.label === newValue.trim())) {
            onNotify('Filter label already exists', 'error');
            return;
        }
        const updatedSettings = {
            ...settings,
            returnFilterOptions: [...options, { label: newValue.trim(), days: newNumberVal }]
        };
        await db.updateSettings(updatedSettings);
        setSettings(updatedSettings);
        setNewValue('');
        setNewNumberVal(7);
        onNotify('Filter option added', 'success');
        return;
    }

    const currentList = settings[activeKey] as string[];
    if (currentList.includes(newValue.trim())) {
      onNotify('Item already exists', 'error');
      return;
    }

    const updatedSettings = {
      ...settings,
      [activeKey]: [...currentList, newValue.trim()]
    };
    
    await db.updateSettings(updatedSettings);
    setSettings(updatedSettings);
    setNewValue('');
    onNotify('Item added successfully', 'success');
  };

  const handleDelete = async (item: string) => {
    if (!settings) return;
    if (confirm(`Are you sure you want to delete "${item}"?`)) {
        let updatedSettings: SystemSettings;
        
        if (activeKey === 'lenderTypes') {
             updatedSettings = {
                ...settings,
                lenderTypes: settings.lenderTypes.filter(t => t.name !== item)
             };
        } else if (activeKey === 'returnFilterOptions') {
             updatedSettings = {
                ...settings,
                returnFilterOptions: settings.returnFilterOptions.filter(o => o.label !== item)
             };
        } else {
             updatedSettings = {
                ...settings,
                [activeKey]: (settings[activeKey] as string[]).filter(i => i !== item)
             };
        }
        
        await db.updateSettings(updatedSettings);
        setSettings(updatedSettings);
        onNotify('Item removed', 'success');
    }
  };

  const startEdit = (item: string | LenderType | ReturnFilterOption) => {
    if (typeof item === 'string') {
        setEditingItem(item);
        setEditValue(item);
    } else {
        // Handle Complex Objects
        if ('name' in item) { // LenderType
            setEditingItem(item.name);
            setEditValue(item.name);
            setEditNumberVal(item.duration);
        } else if ('label' in item) { // ReturnFilterOption
            setEditingItem(item.label);
            setEditValue(item.label);
            setEditNumberVal(item.days);
        }
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingItem || !editValue.trim() || !settings) return;
    
    if (isComplexConfig) {
        // Handle Object Update
        let newSettings = { ...settings };
        
        if (activeKey === 'lenderTypes') {
            const types = [...settings.lenderTypes];
            const idx = types.findIndex(t => t.name === editingItem);
            if (idx !== -1) {
                 if (editValue.trim() !== editingItem && types.some(t => t.name === editValue.trim())) {
                     onNotify('Name already exists', 'error');
                     return;
                 }
                 if (editValue.trim() !== editingItem) {
                     await db.renameSettingValue('lenderTypes', editingItem, editValue.trim());
                     // Refresh from DB as rename helper saves
                     newSettings = await db.getSettings(); 
                 }
                 // Update numeric value
                 const updatedTypes = [...newSettings.lenderTypes];
                 const newIdx = updatedTypes.findIndex(t => t.name === editValue.trim());
                 if (newIdx !== -1) {
                     updatedTypes[newIdx].duration = editNumberVal;
                     newSettings.lenderTypes = updatedTypes;
                     await db.updateSettings(newSettings);
                 }
            }
        } else if (activeKey === 'returnFilterOptions') {
            const options = [...settings.returnFilterOptions];
            const idx = options.findIndex(o => o.label === editingItem);
            if (idx !== -1) {
                 if (editValue.trim() !== editingItem && options.some(o => o.label === editValue.trim())) {
                     onNotify('Label already exists', 'error');
                     return;
                 }
                 if (editValue.trim() !== editingItem) {
                     await db.renameSettingValue('returnFilterOptions', editingItem, editValue.trim());
                     newSettings = await db.getSettings();
                 }
                 const updatedOptions = [...newSettings.returnFilterOptions];
                 const newIdx = updatedOptions.findIndex(o => o.label === editValue.trim());
                 if (newIdx !== -1) {
                     updatedOptions[newIdx].days = editNumberVal;
                     newSettings.returnFilterOptions = updatedOptions;
                     await db.updateSettings(newSettings);
                 }
            }
        }
        
        setSettings(newSettings);
        setEditingItem(null);
        onNotify('Item updated', 'success');
        return;
    }

    // Default String Array Update
    if (editValue.trim() === editingItem) {
        cancelEdit();
        return;
    }

    const success = await db.renameSettingValue(activeKey, editingItem, editValue.trim());
    if (success) {
        const fresh = await db.getSettings();
        setSettings(fresh);
        setEditingItem(null);
        setEditValue('');
        onNotify('Item updated across all records', 'success');
    } else {
        onNotify('Update failed. Value might already exist.', 'error');
    }
  };

  const getActiveLabel = () => {
    for (const section of SECTIONS) {
      const item = section.items.find(i => i.key === activeKey);
      if (item) return item.label;
    }
    return '';
  };
  
  const getDescription = () => {
      if (activeKey === 'lenderTypes') return "Configure lender types and default loan duration.";
      if (activeKey === 'returnFilterOptions') return "Configure options for 'Return Due' filters in Circulation view.";
      return "Add, edit, or remove values available in dropdowns.";
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  if (!settings) return null;

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar Tree View */}
      <div className="w-64 flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4" /> System Settings
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {SECTIONS.map(section => (
            <div key={section.title} className="mb-4">
              <h3 className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <button
                    key={item.key}
                    onClick={() => { setActiveKey(item.key); setNewValue(''); cancelEdit(); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${
                      activeKey === item.key 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                    {activeKey === item.key && <ChevronRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <Card className="flex-1 flex flex-col h-full">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div>
             <h2 className="text-xl font-bold text-slate-800">Manage {getActiveLabel()}</h2>
             <p className="text-sm text-slate-500">{getDescription()}</p>
          </div>
          <div className="text-sm text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
             {settings[activeKey].length} items
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="flex gap-3 mb-6 items-end">
            <Input 
              label={isComplexConfig ? (activeKey === 'returnFilterOptions' ? "Label" : "Name") : undefined}
              placeholder={isComplexConfig ? "e.g. Next 7 Days" : `Add new ${getActiveLabel().toLowerCase().slice(0, -1)}...`}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            {isComplexConfig && (
                <div className="w-32">
                    <Input 
                        label={activeKey === 'returnFilterOptions' ? "Days" : "Duration (Days)"}
                        type="number"
                        min={1}
                        value={newNumberVal}
                        onChange={e => setNewNumberVal(parseInt(e.target.value) || 1)}
                    />
                </div>
            )}
            <Button onClick={handleAdd} disabled={!newValue.trim()} className={isComplexConfig ? "mb-[1px]" : ""}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
            {settings[activeKey].length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No items found. Add one above.
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {/* Render logic depending on type */}
                    {isComplexConfig ? (
                        (settings[activeKey] as any[]).map((item, idx) => {
                            const name = item.name || item.label;
                            const numVal = item.duration || item.days;
                            
                            return (
                                <li key={idx} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors group min-h-[56px]">
                                    {editingItem === name ? (
                                        <div className="flex w-full items-center gap-2 animate-in fade-in">
                                            <input 
                                                autoFocus
                                                className="flex-1 px-3 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                            />
                                            <div className="w-24 relative">
                                                <input 
                                                    type="number"
                                                    className="w-full pl-3 pr-8 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    value={editNumberVal}
                                                    onChange={(e) => setEditNumberVal(parseInt(e.target.value) || 1)}
                                                />
                                                <span className="absolute right-2 top-1.5 text-xs text-slate-400">days</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={saveEdit} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Save">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={cancelEdit} className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200" title="Cancel">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <span className="text-slate-700 font-medium w-40 truncate">{name}</span>
                                                <span className="flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                    {activeKey === 'returnFilterOptions' ? <Filter size={12} className="mr-1"/> : <Clock size={12} className="mr-1"/>} 
                                                    {numVal} days
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => startEdit(item)}
                                                    className="text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(name)}
                                                    className="text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            );
                        })
                    ) : (
                        (settings[activeKey] as string[]).map((item, idx) => (
                            <li key={idx} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors group min-h-[56px]">
                                {editingItem === item ? (
                                    <div className="flex w-full items-center gap-2 animate-in fade-in">
                                        <input 
                                            autoFocus
                                            className="flex-1 px-3 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                        />
                                        <div className="flex gap-1">
                                            <button onClick={saveEdit} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Save">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={cancelEdit} className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200" title="Cancel">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-slate-700">{item}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button 
                                                onClick={() => startEdit(item)}
                                                className="text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item)}
                                                className="text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
