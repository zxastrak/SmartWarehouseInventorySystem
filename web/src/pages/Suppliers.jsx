import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import WarehouseHeader from '../components/WarehouseHeader.jsx';
import DashboardIcon from '../components/DashboardIcon.jsx';
import { poDate, poMoney, poTotal } from '../utils/purchaseOrders.js';
import { categoriesApi } from '../utils/api.js';
import '../styles/dashboard.css';
import '../styles/inventory.css';
import '../styles/inbound.css';
import '../styles/purchaseOrders.css';
import '../styles/suppliers.css';

export default function Suppliers({
  initialSupplier = null,
  manager,
  warehouse,
  suppliers = [],
  inventory = [],
  orders = [],
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onRegisterCatalogItem,
  onUpdateProduct,
  onNavigate,
  onSignOut,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All Suppliers');
  const [sort, setSort] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals state
  const [formModal, setFormModal] = useState(null); // { mode: 'create' } or { mode: 'edit', supplier }
  const [formData, setFormData] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });
  const [deleteTarget, setDeleteTarget] = useState(null); // supplier object
  const [detailsSupplier, setDetailsSupplier] = useState(null); // supplier object
  const [detailsTab, setDetailsTab] = useState('products');
  const [detailsPoPage, setDetailsPoPage] = useState(1);

  useEffect(() => {
    if (initialSupplier && suppliers.length > 0) {
      const found = suppliers.find(
        (s) =>
          String(s.id) === String(initialSupplier) ||
          (s.name && s.name.toLowerCase() === String(initialSupplier).toLowerCase())
      );
      if (found) {
        setDetailsSupplier(found);
      }
    }
  }, [initialSupplier, suppliers]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      if (detailsSupplier) {
        currentUrl.searchParams.set('supplier', detailsSupplier.name || detailsSupplier.id);
      } else {
        currentUrl.searchParams.delete('supplier');
      }
      if (currentUrl.pathname === '/suppliers') {
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search);
      }
    }
  }, [detailsSupplier]);

  // Supplier Detail - Catalog search & filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('All Categories');
  const [catalogStockFilter, setCatalogStockFilter] = useState('All Stock');
  const [catalogSort, setCatalogSort] = useState('name-asc');

  // Product detail & edit modals inside supplier details
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    sku: '',
    price: '',
    unit: 'pcs',
    reorder: 0,
  });

  const [catalogModal, setCatalogModal] = useState(false);
  const [catalogSupplier, setCatalogSupplier] = useState(null);
  const [catalogForm, setCatalogForm] = useState({
    supplier_id: '',
    name: '',
    sku: '',
    category_id: '',
    category_name: '',
    price: '',
    unit: 'pcs',
    stock_quantity: 0,
    reorder: 0,
    location_id: null,
    zone: '—',
    notes: '',
  });

  // Product Category CRUD states
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '', description: '' });
  const [categoryError, setCategoryError] = useState('');
  const [categoryNotice, setCategoryNotice] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  const formDialogRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const detailsDialogRef = useRef(null);
  const catalogDialogRef = useRef(null);
  const categoryDialogRef = useRef(null);
  const productDetailsDialogRef = useRef(null);
  const productEditDialogRef = useRef(null);

  const warehouseName = warehouse?.warehouseName || 'Main Warehouse';

  // Helper mapping for supplier items and orders
  const supplierStats = useMemo(() => {
    const map = {};
    suppliers.forEach((s) => {
      const sName = (s.name || '').toLowerCase().trim();
      const items = inventory.filter(
        (it) => (it.supplier || '').toLowerCase().trim() === sName || it.supplier_id === s.id
      );
      const pos = orders.filter(
        (o) => (o.supplier || '').toLowerCase().trim() === sName || o.supplier_id === s.id
      );
      const activePOs = pos.filter((o) => !['Received', 'Rejected'].includes(o.status));
      map[s.id] = {
        items,
        pos,
        activePOs,
      };
    });
    return map;
  }, [suppliers, inventory, orders]);

  // Overall metric counts
  const totalSuppliers = suppliers.length;
  const activePartners = suppliers.filter(
    (s) => (supplierStats[s.id]?.items.length || 0) > 0 || (supplierStats[s.id]?.pos.length || 0) > 0
  ).length;
  const totalSuppliedItems = inventory.filter((it) => it.supplier).length;
  const totalOpenPOs = orders.filter((o) => !['Received', 'Rejected'].includes(o.status)).length;

  // Filter & Search
  const filtered = useMemo(() => {
    let result = suppliers.filter((s) => {
      const q = query.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const stats = supplierStats[s.id] || { items: [], activePOs: [] };
      if (filter === 'With Products') return stats.items.length > 0;
      if (filter === 'With Active POs') return stats.activePOs.length > 0;
      if (filter === 'No Active Orders') return stats.activePOs.length === 0;
      return true;
    });

    result.sort((a, b) => {
      if (sort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sort === 'items-desc') {
        const countA = supplierStats[a.id]?.items.length || 0;
        const countB = supplierStats[b.id]?.items.length || 0;
        return countB - countA;
      }
      if (sort === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

    return result;
  }, [suppliers, query, filter, sort, supplierStats]);

  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const activePage = Math.min(page, totalPages);
  const visible = filtered.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, filter, sort]);

  // Modal dialog triggers
  useEffect(() => {
    if (formModal) {
      formDialogRef.current?.showModal();
    } else {
      formDialogRef.current?.close();
    }
  }, [formModal]);

  useEffect(() => {
    if (deleteTarget) {
      deleteDialogRef.current?.showModal();
    } else {
      deleteDialogRef.current?.close();
    }
  }, [deleteTarget]);

  useEffect(() => {
    if (detailsSupplier) {
      detailsDialogRef.current?.showModal();
    } else {
      detailsDialogRef.current?.close();
    }
  }, [detailsSupplier]);

  useEffect(() => {
    setDetailsPoPage(1);
  }, [detailsSupplier, detailsTab]);

  useEffect(() => {
    if (catalogModal) {
      catalogDialogRef.current?.showModal();
    } else {
      catalogDialogRef.current?.close();
    }
  }, [catalogModal]);

  useEffect(() => {
    if (categoryModalOpen) {
      categoryDialogRef.current?.showModal();
    } else {
      categoryDialogRef.current?.close();
    }
  }, [categoryModalOpen]);

  useEffect(() => {
    if (detailsProduct) {
      productDetailsDialogRef.current?.showModal();
    } else {
      productDetailsDialogRef.current?.close();
    }
  }, [detailsProduct]);

  useEffect(() => {
    if (editProduct) {
      productEditDialogRef.current?.showModal();
    } else {
      productEditDialogRef.current?.close();
    }
  }, [editProduct]);

  // Load product categories from backend API
  const fetchCategories = useCallback(async () => {
    try {
      const list = await categoriesApi.getAll();
      if (Array.isArray(list)) {
        setCategories(list);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Gagal mengambil data kategori:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function navigate(label) {
    const routes = {
      Dashboard: 'dashboard',
      Inventory: 'inventory',
      Inbound: 'inbound',
      Outbound: 'outbound',
      'AI Insight': 'ai-insight',
      'Purchase Orders': 'purchase-orders',
      Suppliers: 'suppliers',
      Reports: 'reports',
      'Audit Trail': 'audit-trail',
      'Staff Management': 'staff-management',
      Settings: 'settings',
    };
    if (label === 'Suppliers') {
      setQuery('');
      setFilter('All Suppliers');
      setNotice('');
    } else if (routes[label]) {
      onNavigate(routes[label]);
    } else {
      setNotice(`${label} will be connected after its design is implemented.`);
    }
  }

  function openCreateModal() {
    setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
    setError('');
    setFormModal({ mode: 'create' });
  }

  function openEditModal(supplier) {
    setFormData({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setError('');
    setFormModal({ mode: 'edit', supplier });
  }

  function openCatalogModal(preselectedSupplier = null) {
    setError('');
    const targetSup = preselectedSupplier || detailsSupplier || (suppliers.length > 0 ? suppliers[0] : null);
    const supId = targetSup ? targetSup.id : (suppliers[0]?.id || '');
    setCatalogSupplier(targetSup);

    const firstCat = categories.length > 0 ? categories[0] : { id: '', name: '' };

    setCatalogForm({
      supplier_id: supId,
      name: '',
      sku: '',
      category_id: firstCat.id,
      category_name: firstCat.name,
      price: '',
      unit: 'pcs',
      stock_quantity: 0,
      reorder: 0,
      location_id: null,
      zone: '—',
      notes: '',
    });
    setCatalogModal(true);
  }

  function openProductDetailsModal(prod) {
    setDetailsProduct(prod);
    setError('');
  }

  function openEditProductModal(prod) {
    setEditProduct(prod);
    setEditProductForm({
      name: prod.name || '',
      sku: prod.sku || '',
      price: prod.price || 0,
      unit: prod.unit || 'pcs',
      reorder: prod.reorder || 0,
    });
    setError('');
  }

  async function handleSaveEditProduct(e) {
    e.preventDefault();
    if (!editProductForm.name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const updated = {
        ...editProduct,
        name: editProductForm.name.trim(),
        price: Number(editProductForm.price) || 0,
        unit: editProductForm.unit,
        reorder: Number(editProductForm.reorder) || 0,
        reason: `Katalog diperbarui dari detail supplier ${detailsSupplier?.name || ''}`,
      };
      if (onUpdateProduct) {
        await onUpdateProduct(updated);
      }
      setNotice(`Produk "${editProductForm.name}" (${editProductForm.sku}) berhasil diperbarui.`);
      setEditProduct(null);
    } catch (err) {
      setError(err.message || 'Gagal memperbarui produk katalog.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCategoryChange(e) {
    const catId = Number(e.target.value);
    const cat = categories.find((c) => c.id === catId);
    setCatalogForm((prev) => ({
      ...prev,
      category_id: catId,
      category_name: cat?.name || 'General',
    }));
  }

  // Category CRUD Handlers
  async function handleSaveCategory(e) {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryError('Nama kategori wajib diisi.');
      return;
    }
    setIsSubmittingCat(true);
    setCategoryError('');
    setCategoryNotice('');

    try {
      if (categoryForm.id) {
        // Update existing category
        const res = await categoriesApi.update(categoryForm.id, {
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
        });
        if (res?.error || (!res.success && res.status >= 400)) {
          throw new Error(res.data?.message || res.error || 'Gagal memperbarui kategori');
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryForm.id
              ? { ...c, name: categoryForm.name.trim(), description: categoryForm.description.trim() }
              : c
          )
        );
        if (catalogForm.category_id === categoryForm.id) {
          setCatalogForm((prev) => ({ ...prev, category_name: categoryForm.name.trim() }));
        }
        setCategoryNotice(`Kategori "${categoryForm.name.trim()}" berhasil diperbarui.`);
        setCategoryForm({ id: null, name: '', description: '' });
      } else {
        // Create new category
        const res = await categoriesApi.create({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
        });
        if (res?.error || (!res.success && res.status >= 400)) {
          throw new Error(res.data?.message || res.error || 'Gagal menambahkan kategori');
        }
        const newId = res.data?.categoryId || Date.now();
        const newCat = {
          id: newId,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
        };
        setCategories((prev) => [...prev, newCat]);
        setCatalogForm((prev) => ({
          ...prev,
          category_id: newId,
          category_name: newCat.name,
        }));
        setCategoryNotice(`Kategori baru "${newCat.name}" berhasil dibuat & langsung dipilih.`);
        setCategoryForm({ id: null, name: '', description: '' });
      }
    } catch (err) {
      setCategoryError(err.message || 'Gagal menyimpan kategori.');
    } finally {
      setIsSubmittingCat(false);
    }
  }

  function handleStartEditCategory(cat) {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
    });
    setCategoryError('');
    setCategoryNotice('');
  }

  function handleCancelEditCategory() {
    setCategoryForm({ id: null, name: '', description: '' });
    setCategoryError('');
  }

  async function handleDeleteCategory(cat) {
    if (!window.confirm(`Yakin ingin menghapus kategori "${cat.name}"?`)) {
      return;
    }
    setIsSubmittingCat(true);
    setCategoryError('');
    setCategoryNotice('');
    try {
      const res = await categoriesApi.remove(cat.id);
      if (res?.error || (!res.success && res.status >= 400)) {
        throw new Error(res.data?.message || res.error || 'Gagal menghapus kategori');
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (catalogForm.category_id === cat.id) {
        const remaining = categories.filter((c) => c.id !== cat.id);
        if (remaining.length > 0) {
          setCatalogForm((prev) => ({
            ...prev,
            category_id: remaining[0].id,
            category_name: remaining[0].name,
          }));
        }
      }
      if (categoryForm.id === cat.id) {
        setCategoryForm({ id: null, name: '', description: '' });
      }
      setCategoryNotice(`Kategori "${cat.name}" berhasil dihapus.`);
    } catch (err) {
      setCategoryError(err.message || 'Gagal menghapus kategori.');
    } finally {
      setIsSubmittingCat(false);
    }
  }

  async function handleSaveCatalogProduct(e) {
    e.preventDefault();
    const supId = catalogForm.supplier_id || detailsSupplier?.id || catalogSupplier?.id;
    if (!supId) {
      setError('Pemasok supplier tidak ditemukan.');
      return;
    }
    if (!catalogForm.name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    if (!catalogForm.sku.trim()) {
      setError('SKU produk wajib diisi.');
      return;
    }
    if (inventory.some((it) => it.sku.toLowerCase() === catalogForm.sku.trim().toLowerCase())) {
      setError(`SKU "${catalogForm.sku.trim()}" sudah digunakan pada sistem gudang.`);
      return;
    }
    const priceNum = Number(catalogForm.price);
    if (catalogForm.price === '' || isNaN(priceNum) || priceNum < 0) {
      setError('Harga satuan harus berupa angka dan tidak boleh negatif.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const selectedSup = suppliers.find((s) => s.id === Number(supId)) || detailsSupplier || catalogSupplier;
      const matchedCat = categories.find((c) => c.id === Number(catalogForm.category_id));
      const payload = {
        ...catalogForm,
        supplier_id: Number(supId),
        supplier_name: selectedSup?.name || '',
        category_id: Number(catalogForm.category_id),
        category_name: matchedCat?.name || catalogForm.category_name || 'General',
        price: priceNum,
        stock_quantity: 0,
        zone: '—',
        location_id: null,
      };

      if (onRegisterCatalogItem) {
        const res = await onRegisterCatalogItem(payload);
        if (res?.error) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      setNotice(
        `Produk "${catalogForm.name}" (${catalogForm.sku}) berhasil didaftarkan ke katalog ${selectedSup?.name || 'supplier'}!`
      );
      setCatalogModal(false);
    } catch (err) {
      setError(err.message || 'Gagal mendaftarkan produk katalog.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSupplier(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Nama supplier wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (formModal.mode === 'create') {
        const res = await onCreateSupplier(formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setNotice(`Supplier "${formData.name}" berhasil ditambahkan.`);
          setFormModal(null);
        }
      }
    } catch (err) {
      setError(err.message || 'Gagal menyimpan supplier.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await onDeleteSupplier(deleteTarget.id);
      if (res?.error) {
        setError(res.error);
      } else {
        setNotice(`Supplier "${deleteTarget.name}" berhasil dihapus.`);
        setDeleteTarget(null);
        if (detailsSupplier?.id === deleteTarget.id) {
          setDetailsSupplier(null);
        }
      }
    } catch (err) {
      setError(err.message || 'Gagal menghapus supplier.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const getInitials = (name) => {
    if (!name) return 'SU';
    const clean = name.replace(/^(PT|CV|UD|TB)\.?\s+/i, '');
    const parts = clean.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        activePage="Suppliers"
        warehouseName={warehouseName}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={navigate}
      />
      <div className="dashboard-main">
        <WarehouseHeader
          manager={manager}
          search={query}
          onSearch={setQuery}
          onMenu={() => setNavOpen(true)}
          onSignOut={onSignOut}
          onViewProfile={() => onNavigate('settings-profile')}
        />

        <main className="dashboard-content suppliers-content">
          <div className="dashboard-intro">
            <div>
              <p>WAREHOUSE OPERATIONS</p>
              <h1>Suppliers</h1>
              <p className="suppliers-description">
                Manage vendor partnerships, contact information, and supplied inventory catalog.
              </p>
            </div>
            <div className="dashboard-date">
              <p>{currentDate}</p>
              <p>{warehouseName}</p>
            </div>
          </div>

          {/* Metric Cards */}
          <section className="suppliers-metrics" aria-label="Suppliers summary">
            <div className="suppliers-metric metric-green">
              <strong>{totalSuppliers}</strong>
              <div>
                <h2>Total Suppliers</h2>
                <p>Registered vendor partners</p>
              </div>
            </div>
            <div className="suppliers-metric metric-green">
              <strong>{activePartners}</strong>
              <div>
                <h2>Active Partners</h2>
                <p>With items or orders</p>
              </div>
            </div>
            <div className="suppliers-metric metric-neutral">
              <strong>{totalSuppliedItems}</strong>
              <div>
                <h2>Linked SKUs</h2>
                <p>Assigned inventory items</p>
              </div>
            </div>
            <div className="suppliers-metric metric-rose">
              <strong>{totalOpenPOs}</strong>
              <div>
                <h2>Open Orders</h2>
                <p>Awaiting delivery or review</p>
              </div>
            </div>
          </section>

          {/* Main Card */}
          <section className="suppliers-card">
            <div className="suppliers-card-header">
              <div>
                <h2>Supplier Directory</h2>
                <p>Verified suppliers, procurement contacts, and linked warehouse products.</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="suppliers-filters">
              <div className="suppliers-search-box">
                <DashboardIcon name="search" size={18} />
                <input
                  aria-label="Search suppliers"
                  placeholder="Search supplier, contact, phone, or address..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <select
                aria-label="Supplier filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>All Suppliers</option>
                <option>With Products</option>
                <option>With Active POs</option>
                <option>No Active Orders</option>
              </select>

              <select
                aria-label="Sort suppliers"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name-asc">Sort: Name (A–Z)</option>
                <option value="name-desc">Sort: Name (Z–A)</option>
                <option value="items-desc">Sort: Most Products</option>
                <option value="newest">Sort: Newest Added</option>
              </select>

              <div className="suppliers-header-buttons">
                <button
                  type="button"
                  className="inbound-primary btn-new-supplier"
                  onClick={openCreateModal}
                  id="btn-add-supplier"
                >
                  + New Supplier
                </button>
              </div>
            </div>

            {notice && (
              <p role="status" className="form-notice" style={{ marginBottom: 16 }}>
                {notice}
              </p>
            )}

            {/* Table */}
            <div className="suppliers-table-wrap">
              <table className="suppliers-table">
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Contact Person</th>
                    <th>Phone / WhatsApp</th>
                    <th>Address</th>
                    <th>Supplied Items</th>
                    <th>Active POs</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const stats = supplierStats[s.id] || { items: [], pos: [], activePOs: [] };
                    const itemCount = stats.items.length;
                    const activePOCount = stats.activePOs.length;

                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="supplier-cell">
                            <div className="supplier-avatar">{getInitials(s.name)}</div>
                            <div className="supplier-info">
                              <strong>{s.name}</strong>
                              <small>ID: SUP-{String(s.id).padStart(3, '0')}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="supplier-contact">
                            <span className="supplier-contact-name">
                              {s.contact_person || '—'}
                            </span>
                            {s.email && <small style={{ color: '#737b6c' }}>{s.email}</small>}
                          </div>
                        </td>
                        <td>
                          {s.phone ? (
                            <a
                              href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`}
                              className="supplier-phone-link"
                              title="Hubungi via telepon / WhatsApp"
                            >
                               {s.phone}
                            </a>
                          ) : (
                            <span style={{ color: '#737b6c' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              maxWidth: '220px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={s.address || 'Belum ada alamat'}
                          >
                            {s.address || '—'}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge-count ${itemCount === 0 ? 'zero' : ''}`}
                            onClick={() => {
                              setDetailsSupplier(s);
                              setDetailsTab('products');
                            }}
                          >
                             {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge-count ${activePOCount === 0 ? 'zero' : ''}`}
                            onClick={() => {
                              setDetailsSupplier(s);
                              setDetailsTab('orders');
                            }}
                          >
                             {activePOCount} {activePOCount === 1 ? 'Orders' : 'Orders'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="supplier-actions" style={{ justifyContent: 'center' }}>
                            <button
                              className="btn-table-action"
                              onClick={() => {
                                setDetailsSupplier(s);
                                setDetailsTab('products');
                              }}
                              title="Lihat detail supplier & katalog produk"
                            >
                              Details
                            </button>
                            <button
                              className="btn-table-action btn-po"
                              onClick={() => onNavigate('purchase-orders', { supplier: s.name })}
                              title={`Buat Purchase Order untuk ${s.name}`}
                            >
                              + PO
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!visible.length && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: '#737b6c' }}>
                        Tidak ada supplier yang sesuai dengan pencarian atau filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="inventory-pagination" style={{ marginTop: 20 }}>
              <span>
                Showing {filtered.length ? (activePage - 1) * itemsPerPage + 1 : 0}–
                {Math.min(activePage * itemsPerPage, filtered.length)} of {filtered.length} suppliers
              </span>
              <div>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    className={activePage === i + 1 ? 'active-page' : ''}
                    aria-label={`Suppliers page ${i + 1}`}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={activePage === totalPages}
                  aria-label="Next suppliers page"
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Add / Edit Modal Dialog */}
      <dialog
        ref={formDialogRef}
        className="supplier-modal"
        aria-labelledby="supplier-modal-title"
        onCancel={() => setFormModal(null)}
      >
        <div className="supplier-modal-scroll">
          <h2 id="supplier-modal-title">
            {formModal?.mode === 'create' ? 'Tambah Supplier Baru' : 'Edit Data Supplier'}
          </h2>
        <p className="modal-subtitle">
          {formModal?.mode === 'create'
            ? 'Masukkan informasi kontak vendor untuk pengadaan barang gudang.'
            : `Perbarui informasi profil vendor ${formModal?.supplier?.name}.`}
        </p>

        <form onSubmit={handleSaveSupplier} noValidate>
          <div className="supplier-form-grid">
            <div className="supplier-form-field">
              <label htmlFor="sup-name">
                Nama Perusahaan / Supplier <span className="required">*</span>
              </label>
              <input
                id="sup-name"
                placeholder="Contoh: PT Sumber Makmur Sejahtera"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-contact">Nama Kontak Person (PIC)</label>
              <input
                id="sup-contact"
                placeholder="Contoh: Budi Santoso"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-email">Alamat Email</label>
              <input
                id="sup-email"
                type="email"
                placeholder="Contoh: procurement@sumbermakmur.co.id"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-phone">Nomor Telepon / WhatsApp</label>
              <input
                id="sup-phone"
                type="tel"
                placeholder="Contoh: 0812-3456-7890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-address">Alamat Gudang / Kantor</label>
              <textarea
                id="sup-address"
                placeholder="Alamat lengkap supplier..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="field-error" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}

          <div className="supplier-modal-actions" style={{ justifyContent: formModal?.mode === 'edit' ? 'space-between' : 'flex-end', width: '100%' }}>
            {formModal?.mode === 'edit' && (
              <button
                type="button"
                className="btn-modal-delete"
                onClick={() => {
                  const targetSupplier = formModal.supplier;
                  setFormModal(null);
                  setError('');
                  setDeleteTarget(targetSupplier);
                }}
                disabled={isSubmitting}
                title="Hapus supplier ini dari database"
              >
                🗑 Hapus Supplier
              </button>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setFormModal(null)}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="inbound-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menyimpan...' : formModal?.mode === 'create' ? 'Tambah Supplier' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>

      {/* Delete Confirmation Modal */}
      <dialog
        ref={deleteDialogRef}
        className="supplier-modal"
        aria-labelledby="delete-modal-title"
        onCancel={() => setDeleteTarget(null)}
      >
        <div className="supplier-modal-scroll">
          <h2 id="delete-modal-title" style={{ color: '#925958' }}>
          Hapus Supplier
        </h2>
        <p className="modal-subtitle">
          Apakah Anda yakin ingin menghapus supplier <strong>{deleteTarget?.name}</strong>?
        </p>

        {deleteTarget && (
          <div className="delete-warning-box">
            <strong>Perhatian:</strong>
            {supplierStats[deleteTarget.id]?.items.length > 0 ||
            supplierStats[deleteTarget.id]?.pos.length > 0 ? (
              <p style={{ margin: 0 }}>
                Supplier ini terhubung dengan{' '}
                <strong>{supplierStats[deleteTarget.id]?.items.length} item inventaris</strong> dan{' '}
                <strong>{supplierStats[deleteTarget.id]?.pos.length} purchase orders</strong>.
                Menghapus supplier tidak akan menghapus item fisik, namun referensi pemasok pada
                dokumen baru dapat terpengaruh.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Tindakan ini permanen dan akan menghapus catatan kontak supplier dari database.
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="field-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}

        <div className="supplier-modal-actions">
          <button
            type="button"
            className="inbound-secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="inbound-primary"
            style={{ background: '#925958', borderColor: '#925958' }}
            onClick={handleConfirmDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Supplier'}
          </button>
        </div>
      </div>
    </dialog>

      {/* Details & Catalog Modal */}
      <dialog
        ref={detailsDialogRef}
        className="supplier-modal supplier-details-modal"
        aria-labelledby="details-modal-title"
        onCancel={() => setDetailsSupplier(null)}
      >
        {detailsSupplier && (
          <div className="supplier-modal-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16 }}>
              <div>
                <h2 id="details-modal-title" style={{ margin: 0, fontSize: 24 }}>{detailsSupplier.name}</h2>
                <p className="modal-subtitle" style={{ margin: '4px 0 0', fontSize: 13, color: '#737b6c' }}>
                  Supplier ID: SUP-{String(detailsSupplier.id).padStart(3, '0')} · Terdaftar sejak{' '}
                  {detailsSupplier.created_at
                    ? new Date(detailsSupplier.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Awal Sistem'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="inbound-primary"
                  style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8, whiteSpace: 'nowrap' }}
                  onClick={() => openCatalogModal(detailsSupplier)}
                  title="Daftarkan produk baru ke katalog pemasok ini"
                >
                  + Daftarkan Produk ke Katalog
                </button>
                <button
                  type="button"
                  className="inbound-secondary"
                  style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, whiteSpace: 'nowrap' }}
                  onClick={() => openEditModal(detailsSupplier)}
                  title="Edit data profil supplier ini"
                >
                  ✏ Edit Data Supplier
                </button>
                <button
                  type="button"
                  className="dashboard-link"
                  style={{ fontSize: 20, padding: '2px 6px', lineHeight: 1 }}
                  onClick={() => setDetailsSupplier(null)}
                  aria-label="Tutup detail supplier"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="supplier-details-meta">
              <div className="meta-item">
                <dt>Kontak Person (PIC)</dt>
                <dd>{detailsSupplier.contact_person || '—'}</dd>
              </div>
              <div className="meta-item">
                <dt>Telepon / WhatsApp</dt>
                <dd>{detailsSupplier.phone || '—'}</dd>
              </div>
              <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
                <dt>Alamat Lengkap</dt>
                <dd>{detailsSupplier.address || '—'}</dd>
              </div>
            </div>

            <div className="supplier-details-tabs">
              <button
                className={`supplier-tab-btn ${detailsTab === 'products' ? 'active' : ''}`}
                onClick={() => setDetailsTab('products')}
              >
                Katalog Produk ({supplierStats[detailsSupplier.id]?.items.length || 0})
              </button>
              <button
                className={`supplier-tab-btn ${detailsTab === 'orders' ? 'active' : ''}`}
                onClick={() => setDetailsTab('orders')}
              >
                Purchase Orders ({supplierStats[detailsSupplier.id]?.pos.length || 0})
              </button>
            </div>

            {detailsTab === 'products' && (() => {
              const rawSupplierItems = supplierStats[detailsSupplier.id]?.items || [];
              const totalSupplierUnits = rawSupplierItems.reduce((acc, it) => acc + (Number(it.current) || 0), 0);
              const totalSupplierVal = rawSupplierItems.reduce((acc, it) => acc + ((Number(it.current) || 0) * (Number(it.price) || 0)), 0);
              const supplierLowStockCount = rawSupplierItems.filter((it) => (Number(it.current) || 0) <= (Number(it.reorder) || 15) || it.status === 'Critical' || it.status === 'Low').length;
              const supplierCategories = Array.from(new Set(rawSupplierItems.map((it) => it.category).filter(Boolean)));

              let displaySupplierItems = rawSupplierItems.filter((it) => {
                const q = catalogSearch.toLowerCase().trim();
                const matchSearch =
                  !q ||
                  (it.name && it.name.toLowerCase().includes(q)) ||
                  (it.sku && it.sku.toLowerCase().includes(q)) ||
                  (it.category && it.category.toLowerCase().includes(q));

                if (!matchSearch) return false;

                if (catalogCategoryFilter !== 'All Categories' && it.category !== catalogCategoryFilter) {
                  return false;
                }

                if (catalogStockFilter !== 'All Stock') {
                  if (catalogStockFilter === 'In Stock' && ((Number(it.current) || 0) <= 0 || it.status === 'Critical' || it.status === 'Low')) return false;
                  if (catalogStockFilter === 'Low Stock' && !['Critical', 'Low'].includes(it.status) && (Number(it.current) || 0) > (Number(it.reorder) || 15)) return false;
                  if (catalogStockFilter === 'Out of Stock' && (Number(it.current) || 0) > 0) return false;
                }

                return true;
              });

              displaySupplierItems.sort((a, b) => {
                if (catalogSort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
                if (catalogSort === 'name-desc') return (b.name || '').localeCompare(a.name || '');
                if (catalogSort === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
                if (catalogSort === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
                if (catalogSort === 'stock-desc') return (Number(b.current) || 0) - (Number(a.current) || 0);
                if (catalogSort === 'stock-asc') return (Number(a.current) || 0) - (Number(b.current) || 0);
                return 0;
              });

              return (
                <>
                  <div className="supplier-catalog-metrics">
                    <div className="supplier-cat-metric">
                      <span className="cat-metric-label">SKU Terdaftar</span>
                      <strong className="cat-metric-val">{rawSupplierItems.length} SKU</strong>
                    </div>
                    <div className="supplier-cat-metric">
                      <span className="cat-metric-label">Total Unit Fisik</span>
                      <strong className="cat-metric-val">{totalSupplierUnits.toLocaleString('id-ID')} unit</strong>
                    </div>
                    <div className="supplier-cat-metric">
                      <span className="cat-metric-label">Estimasi Nilai Stok</span>
                      <strong className="cat-metric-val">{poMoney(totalSupplierVal)}</strong>
                    </div>
                    <div className={`supplier-cat-metric ${supplierLowStockCount > 0 ? 'alert' : ''}`}>
                      <span className="cat-metric-label">Perlu Restock</span>
                      <strong className="cat-metric-val">{supplierLowStockCount} SKU</strong>
                    </div>
                  </div>

                  <div className="supplier-catalog-toolbar">
                    <div className="supplier-cat-search">
                      <input
                        type="text"
                        placeholder="Cari SKU, nama produk, atau kategori..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        aria-label="Cari produk katalog pemasok"
                      />
                    </div>
                    <select
                      value={catalogCategoryFilter}
                      onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                      aria-label="Filter kategori produk"
                    >
                      <option value="All Categories">Semua Kategori</option>
                      {supplierCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={catalogStockFilter}
                      onChange={(e) => setCatalogStockFilter(e.target.value)}
                      aria-label="Filter status stok produk"
                    >
                      <option value="All Stock">Semua Status Stok</option>
                      <option value="In Stock">Stok Tersedia</option>
                      <option value="Low Stock">Stok Rendah / Kritis</option>
                      <option value="Out of Stock">Stok Kosong</option>
                    </select>
                    <select
                      value={catalogSort}
                      onChange={(e) => setCatalogSort(e.target.value)}
                      aria-label="Urutkan produk katalog"
                    >
                      <option value="name-asc">Urut: Nama (A–Z)</option>
                      <option value="name-desc">Urut: Nama (Z–A)</option>
                      <option value="price-asc">Harga: Terendah</option>
                      <option value="price-desc">Harga: Tertinggi</option>
                      <option value="stock-desc">Stok: Terbanyak</option>
                      <option value="stock-asc">Stok: Tersedikit</option>
                    </select>
                  </div>

                  <div className="suppliers-table-wrap">
                    <table className="supplier-subtable">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Nama Produk</th>
                          <th>Kategori</th>
                          <th>Estimasi Harga Beli</th>
                          <th>Stok Fisik</th>
                          <th>Status Stok</th>
                          <th style={{ textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displaySupplierItems.map((item) => (
                          <tr key={item.sku}>
                            <td>
                              <span className="catalog-sku-badge">{item.sku}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="inventory-thumb" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}>
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="inventory-thumb-img"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className="inventory-thumb-fallback" style={{ display: item.image_url ? 'none' : 'flex', fontSize: 13 }}>
                                    📦
                                  </div>
                                </div>
                                <strong style={{ display: 'block', color: '#1a220d' }}>{item.name}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="catalog-category-badge">{item.category || 'General'}</span>
                            </td>
                            <td>
                              <strong style={{ color: '#2b3910' }}>{poMoney(item.price || 0)}</strong>
                            </td>
                            <td>
                              <strong>{item.current}</strong> {item.unit || 'pcs'}
                              <small style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>Min: {item.reorder ?? 0}</small>
                            </td>
                            <td>
                              <span
                                className={`inventory-status status-${(item.status || 'In Stock')
                                  .toLowerCase()
                                  .replaceAll(' ', '-')}`}
                              >
                                {item.status || 'In Stock'}
                              </span>
                            </td>
                            <td>
                              <div className="supplier-catalog-actions">
                                <button
                                  type="button"
                                  className="btn-catalog-action"
                                  title="Lihat detail spesifikasi produk"
                                  onClick={() => openProductDetailsModal(item)}
                                >
                                  Detail
                                </button>
                                <button
                                  type="button"
                                  className="btn-catalog-action"
                                  title="Edit informasi produk"
                                  onClick={() => openEditProductModal(item)}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!displaySupplierItems.length && (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '28px', color: '#737b6c' }}>
                              {rawSupplierItems.length === 0
                                ? `Belum ada produk yang didaftarkan pada katalog ${detailsSupplier.name}. Klik tombol "+ Daftarkan Produk ke Katalog" di atas untuk menambahkan produk baru.`
                                : 'Tidak ada produk yang cocok dengan filter pencarian.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {detailsTab === 'orders' && (() => {
              const allSupplierPOs = supplierStats[detailsSupplier.id]?.pos || [];
              const poPages = Math.max(1, Math.ceil(allSupplierPOs.length / 5));
              const activePoPage = Math.min(detailsPoPage, poPages);
              const visiblePOs = allSupplierPOs.slice((activePoPage - 1) * 5, activePoPage * 5);

              return (
                <>
                  <div className="suppliers-table-wrap">
                    <table className="supplier-subtable">
                      <thead>
                        <tr>
                          <th>No. PO</th>
                          <th>Tgl Dibuat</th>
                          <th>Est. Tiba</th>
                          <th>Total Items</th>
                          <th>Nilai PO</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePOs.map((po) => (
                          <tr key={po.id}>
                            <td>
                              <strong>{po.id}</strong>
                            </td>
                            <td>{poDate(po.created)}</td>
                            <td>{poDate(po.expected)}</td>
                            <td>{po.products?.length || 0}</td>
                            <td>{poMoney(poTotal(po), po.currency)}</td>
                            <td>
                              <span className={`po-status status-${(po.status || 'Pending').toLowerCase().replaceAll(' ', '-')}`}>
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!allSupplierPOs.length && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#737b6c' }}>
                              Belum ada catatan purchase order untuk pemasok ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {allSupplierPOs.length > 5 && (
                    <div className="inventory-pagination" style={{ marginTop: 14 }}>
                      <span>
                        Showing {allSupplierPOs.length ? (activePoPage - 1) * 5 + 1 : 0}–
                        {Math.min(activePoPage * 5, allSupplierPOs.length)} of {allSupplierPOs.length} orders
                      </span>
                      <div>
                        <button
                          disabled={activePoPage === 1}
                          aria-label="Previous PO page"
                          onClick={() => setDetailsPoPage(activePoPage - 1)}
                        >
                          ‹
                        </button>
                        {Array.from({ length: poPages }, (_, i) => (
                          <button
                            key={i}
                            className={activePoPage === i + 1 ? 'active-page' : ''}
                            aria-label={`PO page ${i + 1}`}
                            onClick={() => setDetailsPoPage(i + 1)}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          disabled={activePoPage === poPages}
                          aria-label="Next PO page"
                          onClick={() => setDetailsPoPage(activePoPage + 1)}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="supplier-modal-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setDetailsSupplier(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="inbound-primary"
                onClick={() => {
                  const supName = detailsSupplier.name;
                  setDetailsSupplier(null);
                  onNavigate('purchase-orders', { supplier: supName });
                }}
              >
                + Buat PO untuk Supplier Ini
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Catalog Registration Modal Dialog */}
      <dialog
        ref={catalogDialogRef}
        className="supplier-modal catalog-modal"
        aria-labelledby="catalog-modal-title"
        onCancel={() => setCatalogModal(false)}
      >
        <div className="supplier-modal-scroll">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id="catalog-modal-title">Daftarkan Katalog Produk Supplier</h2>
            <p className="modal-subtitle">
              Tambahkan produk atau SKU baru yang disediakan oleh vendor ke katalog inventaris gudang.
            </p>
          </div>
        </div>

        {(detailsSupplier || catalogSupplier) && (
          <div className="supplier-prefilled-banner">
            <span>🏢</span>
            <span>
              Mendaftarkan produk langsung ke katalog pemasok: <strong>{(detailsSupplier || catalogSupplier).name}</strong> (SUP-{String((detailsSupplier || catalogSupplier).id).padStart(3, '0')})
            </span>
          </div>
        )}

        <form onSubmit={handleSaveCatalogProduct} noValidate>
          <div className="catalog-form-grid">
            <div className="supplier-form-field full-width">
              <label htmlFor="cat-name">
                Nama Produk Katalog <span className="required">*</span>
              </label>
              <input
                id="cat-name"
                placeholder="Contoh: Barcode Scanner 2D Industrial / Sarung Tangan Safety Nitrile"
                value={catalogForm.name}
                onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                required
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="cat-sku">
                Kode SKU Produk <span className="required">*</span>
              </label>
              <input
                id="cat-sku"
                placeholder="Contoh: SKU-006 / SC-LOG-01"
                value={catalogForm.sku}
                onChange={(e) => setCatalogForm({ ...catalogForm, sku: e.target.value })}
                required
              />
            </div>

            <div className="supplier-form-field">
              <div className="category-field-header">
                <label htmlFor="cat-category">
                  Kategori Produk <span className="required">*</span>
                </label>
                <button
                  type="button"
                  className="btn-manage-cat-inline"
                  onClick={() => {
                    setCategoryError('');
                    setCategoryNotice('');
                    setCategoryForm({ id: null, name: '', description: '' });
                    setCategoryModalOpen(true);
                  }}
                  title="Buka panel kelola kategori produk"
                >
                  ⚙ Kelola Kategori
                </button>
              </div>
              <select
                id="cat-category"
                value={catalogForm.category_id}
                onChange={handleCategoryChange}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="supplier-form-field">
              <label htmlFor="cat-price">
                Estimasi Harga Beli / Satuan (IDR) <span className="required">*</span>
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  id="cat-price"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Contoh: 150000"
                  value={catalogForm.price}
                  onChange={(e) => setCatalogForm({ ...catalogForm, price: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="supplier-form-field">
              <label htmlFor="cat-unit">Satuan Barang</label>
              <select
                id="cat-unit"
                value={catalogForm.unit}
                onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })}
              >
                <option value="pcs">pcs</option>
                <option value="unit">unit</option>
                <option value="box">box</option>
                <option value="set">set</option>
                <option value="pack">pack</option>
                <option value="roll">roll</option>
                <option value="pasang">pasang</option>
              </select>
            </div>

            <div className="supplier-form-field full-width">
              <label htmlFor="cat-reorder">Batas Minimum Reorder (Unit)</label>
              <input
                id="cat-reorder"
                type="number"
                min="1"
                step="1"
                placeholder="15"
                value={catalogForm.reorder || null}
                onChange={(e) => setCatalogForm({ ...catalogForm, reorder: e.target.value })}
              />
            </div>

            <div className="supplier-form-field full-width">
              <label htmlFor="cat-image">Foto / Gambar Produk (URL)</label>
              <input
                id="cat-image"
                type="url"
                placeholder="https://images.unsplash.com/... atau tautan gambar produk"
                value={catalogForm.image_url || ''}
                onChange={(e) => setCatalogForm({ ...catalogForm, image_url: e.target.value })}
              />
            </div>

            <div className="supplier-form-field full-width">
              <label htmlFor="cat-notes">Deskripsi &amp; Catatan Spesifikasi (Opsional)</label>
              <textarea
                id="cat-notes"
                placeholder="Spesifikasi teknis, nomor part vendor, atau ketentuan garansi..."
                value={catalogForm.notes}
                onChange={(e) => setCatalogForm({ ...catalogForm, notes: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="field-error" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}

          <div className="supplier-modal-actions">
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => setCatalogModal(false)}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="inbound-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Mendaftarkan...' : 'Daftarkan ke Katalog'}
            </button>
          </div>
        </form>
      </div>
    </dialog>

      {/* Category Management Modal Dialog */}
      <dialog
        ref={categoryDialogRef}
        className="supplier-modal category-manager-modal"
        aria-labelledby="category-manager-title"
        onCancel={() => setCategoryModalOpen(false)}
      >
        <div className="supplier-modal-scroll">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 id="category-manager-title" style={{ fontSize: 18, margin: '0 0 4px', color: '#191d17' }}>
              Kelola Kategori Produk
            </h2>
            <p className="modal-subtitle" style={{ margin: 0, fontSize: 13, color: '#555d4e' }}>
              Tambah kategori baru, perbarui nama &amp; deskripsi, atau hapus kategori produk gudang.
            </p>
          </div>
          <button
            type="button"
            className="dashboard-link"
            style={{ fontSize: 18, padding: 4 }}
            onClick={() => setCategoryModalOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Notice & Error */}
        {categoryNotice && (
          <div
            className="supplier-prefilled-banner"
            style={{ background: '#f0f7ec', borderColor: '#cfe3c5', color: '#2b3910', marginBottom: 14 }}
          >
            <span>✓</span>
            <span>{categoryNotice}</span>
          </div>
        )}
        {categoryError && (
          <p role="alert" className="field-error" style={{ marginBottom: 14 }}>
            {categoryError}
          </p>
        )}

        {/* Form Create / Update */}
        <div className="category-crud-card">
          <div className="category-crud-card-title">
            <span>{categoryForm.id ? '✏ Edit Kategori' : '+ Tambah Kategori Baru'}</span>
            {categoryForm.id && (
              <span style={{ fontSize: 11, fontWeight: 'normal', color: '#737b6c' }}>
                (ID: {categoryForm.id})
              </span>
            )}
          </div>
          <form onSubmit={handleSaveCategory} noValidate>
            <div className="category-form-inputs">
              <div className="supplier-form-field">
                <label htmlFor="cat-form-name">
                  Nama Kategori <span className="required">*</span>
                </label>
                <input
                  id="cat-form-name"
                  placeholder="Contoh: Packaging / Spareparts"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="supplier-form-field">
                <label htmlFor="cat-form-desc">Deskripsi Singkat</label>
                <input
                  id="cat-form-desc"
                  placeholder="Keterangan jenis kategori..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>
            </div>
            <div className="category-actions-group">
              {categoryForm.id && (
                <button
                  type="button"
                  className="inbound-secondary"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={handleCancelEditCategory}
                  disabled={isSubmittingCat}
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                className="inbound-primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
                disabled={isSubmittingCat}
              >
                {isSubmittingCat
                  ? 'Menyimpan...'
                  : categoryForm.id
                  ? 'Simpan Perubahan'
                  : '+ Tambahkan Kategori'}
              </button>
            </div>
          </form>
        </div>

        {/* Categories Table */}
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 13, color: '#2b3910' }}>
            Daftar Kategori Aktif ({categories.length})
          </strong>
        </div>

        <div className="category-list-wrap">
          <table className="category-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Nama Kategori</th>
                <th style={{ width: '45%' }}>Deskripsi</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td style={{ color: '#555d4e' }}>
                    {c.description || '—'}
                  </td>
                  <td>
                    <div className="category-table-actions">
                      <button
                        type="button"
                        className="btn-cat-action"
                        onClick={() => handleStartEditCategory(c)}
                        title="Edit kategori ini"
                      >
                        ✏ Edit
                      </button>
                      <button
                        type="button"
                        className="btn-cat-action btn-cat-delete"
                        onClick={() => handleDeleteCategory(c)}
                        title="Hapus kategori ini"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: '#737b6c' }}>
                    Belum ada kategori produk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="supplier-modal-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="inbound-primary"
            onClick={() => setCategoryModalOpen(false)}
          >
            Selesai
          </button>
        </div>
      </div>
    </dialog>

      {/* Product Detail Preview Modal */}
      <dialog
        ref={productDetailsDialogRef}
        className="supplier-modal"
        aria-labelledby="prod-details-title"
        onCancel={() => setDetailsProduct(null)}
      >
        {detailsProduct && (
          <div className="supplier-modal-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="catalog-sku-badge" style={{ marginBottom: 8, display: 'inline-block' }}>
                  {detailsProduct.sku}
                </span>
                <h2 id="prod-details-title">{detailsProduct.name}</h2>
                <p className="modal-subtitle">
                  Kategori: <strong>{detailsProduct.category}</strong> · Disuplai oleh <strong>{detailsProduct.supplier || detailsSupplier?.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="dashboard-link"
                style={{ fontSize: 13 }}
                onClick={() => {
                  const p = detailsProduct;
                  setDetailsProduct(null);
                  openEditProductModal(p);
                }}
              >
                ✏ Edit Info
              </button>
            </div>

            <div className="catalog-details-grid">
              <div className="catalog-detail-item">
                <dt>Harga Beli Satuan</dt>
                <dd style={{ color: '#2b3910', fontSize: 18 }}>{poMoney(detailsProduct.price || 0)}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Satuan Barang</dt>
                <dd>{detailsProduct.unit || 'pcs'}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Stok Fisik Saat Ini</dt>
                <dd>{detailsProduct.current ?? 0} {detailsProduct.unit || 'pcs'}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Batas Minimum Reorder</dt>
                <dd>{detailsProduct.reorder ?? null} {detailsProduct.unit || 'pcs'}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Status Ketersediaan</dt>
                <dd>
                  <span className={`inventory-status status-${(detailsProduct.status || 'In Stock').toLowerCase().replaceAll(' ', '-')}`}>
                    {detailsProduct.status || 'In Stock'}
                  </span>
                </dd>
              </div>
              {detailsProduct.notes && (
                <div className="catalog-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <dt>Spesifikasi &amp; Catatan Produk</dt>
                  <dd style={{ fontWeight: 400, color: '#444' }}>{detailsProduct.notes}</dd>
                </div>
              )}
            </div>

            <div className="supplier-modal-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="inbound-primary"
                onClick={() => {
                  const supName = detailsProduct.supplier || detailsSupplier?.name;
                  setDetailsProduct(null);
                  setDetailsSupplier(null);
                  onNavigate('purchase-orders', { supplier: supName });
                }}
              >
                + Buat PO Produk Ini
              </button>
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setDetailsProduct(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Edit Product Modal */}
      <dialog
        ref={productEditDialogRef}
        className="supplier-modal"
        aria-labelledby="prod-edit-title"
        onCancel={() => setEditProduct(null)}
      >
        {editProduct && (
          <div className="supplier-modal-scroll">
            <form onSubmit={handleSaveEditProduct} noValidate>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="catalog-sku-badge" style={{ marginBottom: 8, display: 'inline-block' }}>
                  {editProduct.sku}
                </span>
                <h2 id="prod-edit-title">Edit Produk Katalog</h2>
                <p className="modal-subtitle">Perbarui data produk katalog untuk pemasok {detailsSupplier?.name || editProduct.supplier}.</p>
              </div>
              <button
                type="button"
                className="dashboard-link"
                style={{ fontSize: 18, padding: 4 }}
                onClick={() => setEditProduct(null)}
              >
                ✕
              </button>
            </div>

            <div className="catalog-form-grid">
              <div className="supplier-form-field full-width">
                <label htmlFor="edit-prod-name">Nama Produk <span className="required">*</span></label>
                <input
                  id="edit-prod-name"
                  value={editProductForm.name}
                  onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="supplier-form-field">
                <label htmlFor="edit-prod-price">Harga Beli Satuan (IDR) <span className="required">*</span></label>
                <div className="currency-input-wrapper">
                  <span className="currency-prefix">Rp</span>
                  <input
                    id="edit-prod-price"
                    type="number"
                    min="0"
                    step="1000"
                    value={editProductForm.price}
                    onChange={(e) => setEditProductForm({ ...editProductForm, price: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="supplier-form-field">
                <label htmlFor="edit-prod-unit">Satuan Barang</label>
                <select
                  id="edit-prod-unit"
                  value={editProductForm.unit}
                  onChange={(e) => setEditProductForm({ ...editProductForm, unit: e.target.value })}
                >
                  <option value="pcs">pcs</option>
                  <option value="unit">unit</option>
                  <option value="box">box</option>
                  <option value="set">set</option>
                  <option value="pack">pack</option>
                  <option value="roll">roll</option>
                  <option value="pasang">pasang</option>
                </select>
              </div>

              <div className="supplier-form-field full-width">
                <label htmlFor="edit-prod-reorder">Batas Minimum Reorder</label>
                <input
                  id="edit-prod-reorder"
                  type="number"
                  min="1"
                  step="1"
                  value={editProductForm.reorder}
                  onChange={(e) => setEditProductForm({ ...editProductForm, reorder: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="field-error" style={{ marginTop: 16 }}>
                {error}
              </p>
            )}

            <div className="supplier-modal-actions">
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setEditProduct(null)}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="inbound-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </dialog>
    </div>
  );
}
