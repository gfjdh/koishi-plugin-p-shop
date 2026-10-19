(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SatoriShopCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODES = new Set(['shop', 'inventory']);
  const SOURCE_TYPES = ['shop', 'event', 'drop', 'exchange', 'achievement', 'gift', 'other'];
  const SOURCE_NAMES = { shop: 'P点商店', event: '活动奖励', drop: '掉落', exchange: '兑换', achievement: '成就奖励', gift: '赠送', other: '其他途径' };
  const MAX_QTY = Number.MAX_SAFE_INTEGER;
  function integer(value, fallback = 0) {
    if (value === '' || value === null || typeof value === 'boolean') return fallback;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function validateCatalog(catalog) {
    if (!Array.isArray(catalog)) throw new TypeError('catalog 必须是道具数组');
    const seen = new Set();
    return catalog.map((item, index) => {
      if (!item || typeof item !== 'object') throw new TypeError(`第 ${index + 1} 件道具无效`);
      if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(item.id)) throw new TypeError(`无效道具 id：${item.id}`);
      if (seen.has(item.id)) throw new TypeError(`重复道具 id：${item.id}`);
      seen.add(item.id);
      if (typeof item.name !== 'string' || !item.name.trim()) throw new TypeError(`${item.id} 缺少名称`);
      if (integer(item.price, -1) < 0) throw new TypeError(`${item.id} 的价格须为非负安全整数`);
      if (!Array.isArray(item.acquisition)) throw new TypeError(`${item.id} 缺少 acquisition 数组`);
      for (const source of item.acquisition) {
        if (!source || !SOURCE_TYPES.includes(source.type)) throw new TypeError(`${item.id} 的获取方式 type 无效`);
        if (source.enabled !== undefined && typeof source.enabled !== 'boolean') throw new TypeError(`${item.id} 的 enabled 必须是布尔值`);
      }
      return copy({ ...item, price: integer(item.price), description: String(item.description || ''), category: String(item.category || '其他') });
    });
  }
  function activeSources(item) { return (item.acquisition || []).filter(source => source.enabled !== false); }
  function isInShop(item) { return activeSources(item).some(source => source.type === 'shop'); }
  function acquisitionText(item) {
    return activeSources(item).map(source => String(source.label || SOURCE_NAMES[source.type])).join(' / ') || '获取途径暂未公开';
  }
  function normalizeInventory(inventory, catalog) {
    const lookup = new Map();
    for (const item of catalog) for (const name of [item.id, item.name, ...(item.aliases || [])]) lookup.set(name, item.id);
    const quantities = new Map();
    const entries = Array.isArray(inventory)
      ? inventory.map(entry => [entry && (entry.id || entry.name), entry && (entry.quantity ?? entry.count)])
      : Object.entries(inventory || {});
    for (const [key, value] of entries) {
      if (typeof key !== 'string' || !key) continue;
      const qty = integer(value);
      if (!qty) continue;
      const id = lookup.get(key) || key;
      quantities.set(id, Math.min(MAX_QTY, (quantities.get(id) || 0) + qty));
    }
    return quantities;
  }
  function getViewModel(catalogInput, options = {}) {
    const catalog = validateCatalog(catalogInput);
    const mode = options.mode === 'backpack' ? 'inventory' : (options.mode || 'shop');
    if (!MODES.has(mode)) throw new TypeError('mode 仅支持 shop / inventory');
    const quantities = normalizeInventory(options.inventory, catalog);
    let rows = mode === 'shop' ? catalog.filter(isInShop) : catalog.filter(item => quantities.has(item.id));
    if (mode === 'inventory') {
      const known = new Set(catalog.map(item => item.id));
      for (const [id] of quantities) if (!known.has(id)) rows.push({ id, name: `未登记物品 · ${id}`, price: 0, category: '其他', description: '', acquisition: [], icon: 'unknown', unknown: true });
    }
    if (options.category && options.category !== '全部') rows = rows.filter(item => item.category === options.category);
    rows = rows.map(item => ({ ...item, quantity: quantities.get(item.id) || 0, acquisitionText: acquisitionText(item), inShop: isInShop(item) }));
    const total = rows.length;
    const pageSize = Math.min(5, Math.max(1, integer(options.pageSize, 5)));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    let page = Math.min(pages, Math.max(1, integer(options.page, 1)));
    if (options.page === undefined && options.selectedId) {
      const found = rows.findIndex(item => item.id === options.selectedId);
      if (found >= 0) page = Math.floor(found / pageSize) + 1;
    }
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    const selected = items.find(item => item.id === options.selectedId) || items[0] || null;
    return { mode, page, pages, pageSize, total, items, selected,
      balance: options.balance == null ? null : integer(options.balance),
      inventory: Object.fromEntries(quantities),
      title: mode === 'shop' ? 'P点商店' : '我的背包',
      subtitle: mode === 'shop' ? 'P O I N T  S H O P' : 'I N V E N T O R Y',
      line: String(options.line ?? (mode === 'shop' ? '慢慢挑，不用把心思藏起来。' : '都替你收好了。'))
    };
  }
  function updateAcquisition(catalogInput, id, sources) {
    const catalog = validateCatalog(catalogInput);
    const item = catalog.find(row => row.id === id);
    if (!item) throw new Error(`找不到道具：${id}`);
    item.acquisition = copy(sources);
    return validateCatalog(catalog);
  }
  return { validateCatalog, getViewModel, normalizeInventory, activeSources, isInShop, acquisitionText, updateAcquisition, SOURCE_TYPES, SOURCE_NAMES };
});
