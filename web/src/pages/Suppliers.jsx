import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import WarehouseHeader from '../components/WarehouseHeader.jsx';
import DashboardIcon from '../components/DashboardIcon.jsx';
import { poDate, poMoney, poTotal } from '../utils/purchaseOrders.js';
import { categoriesApi, unitsApi } from '../utils/api.js';
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
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    bank_name: '',
    bank_account: '',
    bank_holder: '',
  });
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
  const [catalogPage, setCatalogPage] = useState(1);

  // Product detail & edit modals inside supplier details
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    category_name: '',
    price: '',
    unit: '',
    weight: '',
    weight_unit: 'kg',
    reorder: 15,
    image_url: '',
    notes: '',
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
    unit: '',
    weight: '',
    weight_unit: 'kg',
    stock_quantity: 0,
    reorder: 15,
    image_url: '',
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

  // Product Units CRUD states
  const [unitsList, setUnitsList] = useState([]);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({ id: null, name: '' });
  const [unitError, setUnitError] = useState('');
  const [unitNotice, setUnitNotice] = useState('');
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false);

  const formDialogRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const detailsDialogRef = useRef(null);
  const catalogDialogRef = useRef(null);
  const categoryDialogRef = useRef(null);
  const unitDialogRef = useRef(null);
  const productDetailsDialogRef = useRef(null);
  const productEditDialogRef = useRef(null);
  const catalogFileInputRef = useRef(null);
  const editProductFileInputRef = useRef(null);

  function handleImageFileCatalog(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setCatalogForm((cur) => ({ ...cur, image_url: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function handleImageFileEdit(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setEditProductForm((cur) => ({ ...cur, image_url: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  }

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
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.bank_name && s.bank_name.toLowerCase().includes(q)) ||
        (s.bank_account && s.bank_account.toLowerCase().includes(q)) ||
        (s.bank_holder && s.bank_holder.toLowerCase().includes(q));

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
    if (unitModalOpen) {
      unitDialogRef.current?.showModal();
    } else {
      unitDialogRef.current?.close();
    }
  }, [unitModalOpen]);

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

  // Load product units from backend API
  const fetchUnits = useCallback(async () => {
    try {
      const list = await unitsApi.getAll();
      if (Array.isArray(list)) {
        setUnitsList(list);
      } else {
        setUnitsList([]);
      }
    } catch (err) {
      console.error('Gagal mengambil data satuan:', err);
      setUnitsList([]);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Reset catalog pagination when filter or active supplier changes
  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, catalogCategoryFilter, catalogStockFilter, catalogSort, detailsSupplier?.id]);

  function navigate(label) {
    if (label === 'Warehouse Layout') {
      onNavigate?.('warehouse-layout');
      return;
    }
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
    }
  }

  function openCreateModal() {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      bank_name: '',
      bank_account: '',
      bank_holder: '',
    });
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
      bank_name: supplier.bank_name || '',
      bank_account: supplier.bank_account || '',
      bank_holder: supplier.bank_holder || '',
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
    const defaultUnit = unitsList.length > 0 ? unitsList[0].name : '';

    setCatalogForm({
      supplier_id: supId,
      name: '',
      sku: '',
      category_id: firstCat.id,
      category_name: firstCat.name,
      price: '',
      unit: defaultUnit,
      weight: '',
      weight_unit: 'kg',
      stock_quantity: 0,
      reorder: 15,
      image_url: '',
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
    const matchedCategory = categories.find(
      (c) => c.name?.toLowerCase() === prod.category?.toLowerCase() || c.id === prod.category_id || String(c.id) === String(prod.category_id)
    );
    setEditProductForm({
      name: prod.name || '',
      sku: prod.sku || '',
      category_id: matchedCategory ? matchedCategory.id : (prod.category_id || (categories[0]?.id || '')),
      category_name: matchedCategory ? matchedCategory.name : (prod.category || 'General'),
      price: prod.price || 0,
      unit: prod.unit || (unitsList.length > 0 ? unitsList[0].name : ''),
      weight: prod.weight !== null && prod.weight !== undefined ? String(prod.weight) : '',
      weight_unit: prod.weight_unit || 'kg',
      reorder: prod.reorder ?? prod.reorder_level ?? 15,
      image_url: prod.image_url || '',
      notes: prod.notes || prod.description || '',
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
      const matchedCat = categories.find((c) => c.id === Number(editProductForm.category_id));
      const finalCategoryName = matchedCat?.name || editProductForm.category_name || editProduct.category || 'General';
      const updated = {
        ...editProduct,
        name: editProductForm.name.trim(),
        category_id: editProductForm.category_id ? Number(editProductForm.category_id) : null,
        category: finalCategoryName,
        category_name: finalCategoryName,
        price: Number(editProductForm.price) || 0,
        unit: editProductForm.unit || (unitsList.length > 0 ? unitsList[0].name : 'pcs'),
        weight: editProductForm.weight !== '' && !isNaN(Number(editProductForm.weight)) ? Number(editProductForm.weight) : null,
        weight_unit: editProductForm.weight_unit || 'kg',
        reorder: Number(editProductForm.reorder) || 15,
        reorder_level: Number(editProductForm.reorder) || 15,
        min_order: Number(editProductForm.reorder) || 15,
        image_url: editProductForm.image_url || null,
        description: editProductForm.notes || editProduct.description || '',
        notes: editProductForm.notes || editProduct.notes || '',
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

  // Unit CRUD Handlers
  async function handleSaveUnit(e) {
    e.preventDefault();
    if (!unitForm.name.trim()) {
      setUnitError('Nama satuan wajib diisi.');
      return;
    }
    setIsSubmittingUnit(true);
    setUnitError('');
    setUnitNotice('');

    const unitName = unitForm.name.trim();

    try {
      if (unitForm.id) {
        const res = await unitsApi.update(unitForm.id, {
          name: unitName,
          label: unitName,
          description: '',
          default_weight_kg: null,
        });
        if (res?.error || (!res.success && res.status >= 400)) {
          throw new Error(res.data?.message || res.error || 'Gagal memperbarui satuan');
        }
        await fetchUnits();
        setUnitNotice(`Satuan "${unitName}" berhasil diperbarui.`);
        setUnitForm({ id: null, name: '' });
      } else {
        const res = await unitsApi.create({
          name: unitName,
          label: unitName,
          description: '',
          default_weight_kg: null,
        });
        if (res?.error || (!res.success && res.status >= 400)) {
          throw new Error(res.data?.message || res.error || 'Gagal menambahkan satuan');
        }
        await fetchUnits();
        setCatalogForm((prev) => ({
          ...prev,
          unit: unitName,
        }));
        setUnitNotice(`Satuan baru "${unitName}" berhasil ditambahkan & langsung dipilih.`);
        setUnitForm({ id: null, name: '' });
      }
    } catch (err) {
      setUnitError(err.message || 'Gagal menyimpan satuan.');
    } finally {
      setIsSubmittingUnit(false);
    }
  }

  function handleStartEditUnit(u) {
    setUnitForm({
      id: u.id,
      name: u.label || u.name,
    });
    setUnitError('');
    setUnitNotice('');
  }

  function handleCancelEditUnit() {
    setUnitForm({ id: null, name: '' });
    setUnitError('');
  }

  async function handleDeleteUnit(u) {
    if (!window.confirm(`Yakin ingin menghapus satuan "${u.label || u.name}"?`)) return;
    setIsSubmittingUnit(true);
    setUnitError('');
    setUnitNotice('');
    try {
      const res = await unitsApi.remove(u.id);
      if (res?.error || (!res.success && res.status >= 400)) {
        throw new Error(res.data?.message || res.error || 'Gagal menghapus satuan');
      }
      await fetchUnits();
      if (catalogForm.unit === u.name) {
        setCatalogForm((prev) => ({ ...prev, unit: '' }));
      }
      setUnitNotice(`Satuan "${u.label || u.name}" berhasil dihapus.`);
    } catch (err) {
      setUnitError(err.message || 'Gagal menghapus satuan.');
    } finally {
      setIsSubmittingUnit(false);
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
    const cleanSku = catalogForm.sku.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (!cleanSku) {
      setError('SKU produk wajib diisi.');
      return;
    }
    if (cleanSku.length > 7) {
      setError('SKU produk maksimal 7 karakter.');
      return;
    }
    if (!/^[A-Z0-9]{1,7}$/.test(cleanSku)) {
      setError('SKU produk hanya boleh memuat huruf kapital (A–Z) dan angka (0–9).');
      return;
    }
    if (inventory.some((it) => it.sku.toLowerCase() === cleanSku.toLowerCase())) {
      setError(`SKU "${cleanSku}" sudah digunakan pada sistem gudang.`);
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
      const reorderNum = Number(catalogForm.reorder) || 15;
      const defaultUnit = unitsList.length > 0 ? unitsList[0].name : 'pcs';
      const payload = {
        ...catalogForm,
        sku: cleanSku,
        supplier_id: Number(supId),
        supplier_name: selectedSup?.name || '',
        category_id: Number(catalogForm.category_id),
        category_name: matchedCat?.name || catalogForm.category_name || 'General',
        price: priceNum,
        unit: catalogForm.unit || defaultUnit,
        weight: catalogForm.weight !== '' && !isNaN(Number(catalogForm.weight)) ? Number(catalogForm.weight) : null,
        weight_unit: catalogForm.weight_unit || 'kg',
        reorder: reorderNum,
        reorder_level: reorderNum,
        min_order: reorderNum,
        image_url: catalogForm.image_url || null,
        description: catalogForm.notes || '',
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
      } else if (formModal.mode === 'edit') {
        const res = await onUpdateSupplier(formModal.supplier.id, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setNotice(`Perubahan data supplier "${formData.name}" berhasil disimpan.`);
          if (detailsSupplier && detailsSupplier.id === formModal.supplier.id) {
            setDetailsSupplier((prev) => ({ ...prev, ...formData }));
          }
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
                    <th>Actions</th>
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
                            className="supplier-address-cell"
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

            <div className="supplier-form-field full-width">
              <label htmlFor="sup-address">Alamat Gudang / Kantor</label>
              <textarea
                id="sup-address"
                placeholder="Alamat lengkap supplier..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                style={{ minHeight: '64px' }}
              />
            </div>

            <div className="supplier-form-divider full-width">
              <span>Informasi Rekening Bank (Untuk Pembayaran PO)</span>
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-bank-name">Nama Bank</label>
              <input
                id="sup-bank-name"
                placeholder="Contoh: BCA, Mandiri, BRI, BNI, BSI"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>

            <div className="supplier-form-field">
              <label htmlFor="sup-bank-account">Nomor Rekening</label>
              <input
                id="sup-bank-account"
                placeholder="Contoh: 1234567890"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              />
            </div>

            <div className="supplier-form-field full-width">
              <label htmlFor="sup-bank-holder">Atas Nama Rekening (A/N)</label>
              <input
                id="sup-bank-holder"
                placeholder="Contoh: PT Sumber Makmur Sejahtera"
                value={formData.bank_holder}
                onChange={(e) => setFormData({ ...formData, bank_holder: e.target.value })}
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
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog
        ref={deleteDialogRef}
        className="supplier-modal"
        aria-labelledby="delete-modal-title"
        onCancel={() => setDeleteTarget(null)}
      >
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
      </dialog>

      {/* Details & Catalog Modal */}
      <dialog
        ref={detailsDialogRef}
        className="supplier-modal supplier-details-modal"
        aria-labelledby="details-modal-title"
        onCancel={() => setDetailsSupplier(null)}
      >
        {detailsSupplier && (
          <>
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
                <dd title={detailsSupplier.contact_person || ''}>{detailsSupplier.contact_person || '—'}</dd>
              </div>
              <div className="meta-item">
                <dt>Email Supplier</dt>
                <dd title={detailsSupplier.email || ''}>
                  {detailsSupplier.email ? (
                    <a href={`mailto:${detailsSupplier.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {detailsSupplier.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="meta-item">
                <dt>Telepon / WhatsApp</dt>
                <dd title={detailsSupplier.phone || ''}>{detailsSupplier.phone || '—'}</dd>
              </div>
              <div className="meta-item meta-item-bank">
                <dt>Rekening Bank Pembayaran</dt>
                <dd>
                  {detailsSupplier.bank_name || detailsSupplier.bank_account ? (
                    <div className="details-bank-compact">
                      <span className="details-bank-pill">🏦 {detailsSupplier.bank_name || 'Bank'}</span>
                      <span className="details-bank-number">{detailsSupplier.bank_account || '—'}</span>
                      {detailsSupplier.bank_holder && (
                        <span className="details-bank-holder" title={`a.n ${detailsSupplier.bank_holder}`}>
                          (a.n {detailsSupplier.bank_holder})
                        </span>
                      )}
                      {detailsSupplier.bank_account && (
                        <button
                          type="button"
                          className="btn-copy-bank-compact"
                          onClick={() => {
                            navigator.clipboard?.writeText(detailsSupplier.bank_account);
                            setNotice(`Nomor rekening ${detailsSupplier.bank_name ? detailsSupplier.bank_name + ' ' : ''}${detailsSupplier.bank_account} berhasil disalin!`);
                          }}
                          title="Salin nomor rekening ke clipboard"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#737b6c', fontSize: 12, fontStyle: 'italic', fontWeight: 400 }}>
                      Belum ada rekening
                    </span>
                  )}
                </dd>
              </div>
              <div className="meta-item meta-item-address">
                <dt>Alamat Lengkap</dt>
                <dd title={detailsSupplier.address || ''}>{detailsSupplier.address || '—'}</dd>
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

              const catalogPages = Math.max(1, Math.ceil(displaySupplierItems.length / 5));
              const activeCatalogPage = Math.min(catalogPage, catalogPages);
              const visibleCatalogItems = displaySupplierItems.slice((activeCatalogPage - 1) * 5, activeCatalogPage * 5);

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
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCatalogItems.map((item) => (
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
                              <small style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>
                                Min. Order: {item.reorder ?? item.reorder_level ?? 15} {item.unit || 'pcs'}
                              </small>
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

                  {displaySupplierItems.length > 5 && (
                    <div className="inventory-pagination" style={{ marginTop: 12 }}>
                      <span>
                        Showing {displaySupplierItems.length ? (activeCatalogPage - 1) * 5 + 1 : 0}–
                        {Math.min(activeCatalogPage * 5, displaySupplierItems.length)} of {displaySupplierItems.length} produk
                      </span>
                      <div>
                        <button
                          disabled={activeCatalogPage === 1}
                          aria-label="Previous catalog page"
                          onClick={() => setCatalogPage(activeCatalogPage - 1)}
                        >
                          ‹
                        </button>
                        {Array.from({ length: catalogPages }, (_, i) => (
                          <button
                            key={i}
                            className={activeCatalogPage === i + 1 ? 'active-page' : ''}
                            aria-label={`Catalog page ${i + 1}`}
                            onClick={() => setCatalogPage(i + 1)}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          disabled={activeCatalogPage === catalogPages}
                          aria-label="Next catalog page"
                          onClick={() => setCatalogPage(activeCatalogPage + 1)}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
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

            <div className="supplier-modal-actions">
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
          </>
        )}
      </dialog>

      {/* Catalog Registration Modal Dialog - Split View (1140px) */}
      <dialog
        ref={catalogDialogRef}
        className="supplier-modal catalog-modal"
        aria-labelledby="catalog-modal-title"
        onCancel={() => setCatalogModal(false)}
      >
        <div className="catalog-modal-header">
          <div>
            <h2 id="catalog-modal-title">Daftarkan Katalog Produk Supplier</h2>
            <p className="modal-subtitle">
              Tambahkan produk atau SKU baru yang disediakan oleh vendor ke katalog inventaris gudang.
            </p>
          </div>
          <button
            type="button"
            className="dashboard-link"
            style={{ fontSize: 18, padding: 4, cursor: 'pointer', background: 'transparent', border: 'none' }}
            onClick={() => setCatalogModal(false)}
            aria-label="Tutup Dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveCatalogProduct} noValidate className="catalog-modal-form-wrap">
          <div className="catalog-split-body">
            {/* PANEL KIRI: Live Preview Card */}
            <aside className="catalog-preview-panel">
              <div className="catalog-preview-header">
                <span className="catalog-preview-title">👁️ Live Preview Katalog</span>
                <span className="catalog-preview-tag">Real-time</span>
              </div>

              <div className="catalog-live-card">
                <div className="catalog-live-image-box">
                  {catalogForm.image_url ? (
                    <img
                      src={catalogForm.image_url}
                      alt={catalogForm.name || 'Preview Produk'}
                      className="catalog-live-img"
                    />
                  ) : (
                    <div className="catalog-live-img-placeholder">
                      <span style={{ fontSize: 36 }}>📦</span>
                      <span style={{ fontSize: 11, color: '#737b6c', fontWeight: 600 }}>Foto Produk</span>
                    </div>
                  )}
                  <div className="catalog-live-badges-overlay">
                    <span className="barcode-badge-item">
                      ║▌║ {catalogForm.sku ? catalogForm.sku.toUpperCase() : 'SKU-001'}
                    </span>
                  </div>
                </div>

                <div className="catalog-live-content">
                  <div className="catalog-live-category-row">
                    <span className="catalog-live-cat-pill">
                      {categories.find((c) => String(c.id) === String(catalogForm.category_id))?.name ||
                        catalogForm.category_name ||
                        'Kategori Produk'}
                    </span>
                    <span className="catalog-live-status-pill">Siap Di-PO</span>
                  </div>

                  <h3 className="catalog-live-name">
                    {catalogForm.name.trim() || 'Nama Produk Katalog'}
                  </h3>

                  <div className="catalog-live-price-box">
                    <span className="catalog-live-price-label">Harga Beli Satuan:</span>
                    <div className="catalog-live-price-val">
                      {catalogForm.price !== '' && !isNaN(Number(catalogForm.price))
                        ? `Rp ${Number(catalogForm.price).toLocaleString('id-ID')}`
                        : 'Rp 0'}
                      <span className="catalog-live-unit">
                        / {catalogForm.unit || 'Unit'}
                      </span>
                    </div>
                  </div>

                  <div className="catalog-live-meta-grid">
                    <div className="catalog-live-meta-item">
                      <span className="meta-label">Min. Order</span>
                      <span className="meta-val">
                        {catalogForm.reorder ? `${catalogForm.reorder} ${catalogForm.unit || 'Unit'}` : '-'}
                      </span>
                    </div>
                    <div className="catalog-live-meta-item">
                      <span className="meta-label">Berat Satuan</span>
                      <span className="meta-val">
                        {catalogForm.weight ? `${catalogForm.weight} ${catalogForm.weight_unit || 'kg'}` : '-'}
                      </span>
                    </div>
                  </div>

                  {catalogForm.notes?.trim() && (
                    <div className="catalog-live-notes">
                      <span className="notes-label">Catatan Spesifikasi:</span>
                      <p>{catalogForm.notes.trim()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="catalog-preview-info-box">
                <span className="info-icon">ℹ️</span>
                <p>
                  Barang katalog belum memiliki unit fisik. Stok otomatis masuk saat barang diterima di dok melalui alur <strong>Inbound PO</strong>.
                </p>
              </div>
            </aside>

            {/* PANEL KANAN: Form Input Fields */}
            <div className="catalog-form-panel">
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
                  <div className="catalog-field-header">
                    <label htmlFor="cat-sku">
                      Kode SKU Produk <span className="required">*</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#737b6c', fontWeight: 600 }}>
                      {catalogForm.sku.length}/7 Karakter
                    </span>
                  </div>
                  <input
                    id="cat-sku"
                    placeholder="Maks. 7 huruf/angka (cth: BRS001)"
                    value={catalogForm.sku}
                    maxLength={7}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}
                    onChange={(e) => {
                      const sanitized = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
                      setCatalogForm({ ...catalogForm, sku: sanitized });
                    }}
                    required
                  />
                  <small style={{ fontSize: '11px', color: '#737b6c', marginTop: '4px', display: 'block' }}>
                    Hanya huruf kapital (A–Z) dan angka (0–9), maksimal 7 karakter.
                  </small>
                </div>

                <div className="supplier-form-field">
                  <div className="catalog-field-header">
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

                <div className="supplier-form-divider full-width">
                  <span>Spesifikasi Pembelian &amp; Satuan</span>
                </div>

                <div className="supplier-form-field">
                  <label htmlFor="cat-price">
                    Harga Beli Satuan (IDR) <span className="required">*</span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label htmlFor="cat-unit" style={{ margin: 0 }}>
                      Satuan Barang <span className="required">*</span>
                    </label>
                    <button
                      type="button"
                      className="btn-manage-cat-inline"
                      onClick={() => {
                        setUnitError('');
                        setUnitNotice('');
                        setUnitForm({ id: null, name: '' });
                        setUnitModalOpen(true);
                      }}
                      title="Buka panel kelola master satuan produk"
                    >
                      ⚙ Kelola Satuan
                    </button>
                  </div>
                  <select
                    id="cat-unit"
                    value={catalogForm.unit || ''}
                    onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })}
                    required
                  >
                    {unitsList.length === 0 ? (
                      <option value="" disabled>Belum ada satuan. Klik '⚙ Kelola Satuan' untuk menambah</option>
                    ) : (
                      unitsList.map((u) => (
                        <option key={u.id || u.name} value={u.name}>
                          {u.label || u.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="supplier-form-field">
                  <label htmlFor="cat-reorder">Batas Minimum Order (Unit)</label>
                  <input
                    id="cat-reorder"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="10"
                    value={catalogForm.reorder || ''}
                    onChange={(e) => setCatalogForm({ ...catalogForm, reorder: e.target.value })}
                  />
                </div>

                <div className="supplier-form-field">
                  <label htmlFor="cat-weight">Berat Barang (Opsional)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="cat-weight"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Contoh: 50"
                      value={catalogForm.weight}
                      onChange={(e) => setCatalogForm({ ...catalogForm, weight: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <select
                      id="cat-weight-unit"
                      value={catalogForm.weight_unit || 'kg'}
                      onChange={(e) => setCatalogForm({ ...catalogForm, weight_unit: e.target.value })}
                      style={{ width: '100px' }}
                    >
                      <option value="kg">kg</option>
                      <option value="gram">gram</option>
                      <option value="ton">ton</option>
                      <option value="liter">liter</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>

                <div className="supplier-form-divider full-width">
                  <span>Foto &amp; Keterangan Produk</span>
                </div>

                <div className="catalog-photo-section">
                  <label>Foto Produk Katalog</label>
                  <div className="catalog-photo-wrap">
                    <div className="catalog-photo-preview-box">
                      {catalogForm.image_url ? (
                        <img
                          src={catalogForm.image_url}
                          alt="Preview Produk"
                          className="catalog-photo-preview-img"
                        />
                      ) : (
                        <div className="catalog-photo-placeholder">
                          <span style={{ fontSize: 24 }}>📦</span>
                          <span>Belum ada foto</span>
                        </div>
                      )}
                    </div>
                    <div className="catalog-photo-inputs">
                      <input
                        type="file"
                        ref={catalogFileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageFileCatalog}
                      />
                      <div className="catalog-photo-actions-row">
                        <button
                          type="button"
                          className="btn-upload-photo"
                          onClick={() => catalogFileInputRef.current?.click()}
                        >
                          📷 Upload Foto 
                        </button>
                        {catalogForm.image_url && (
                          <button
                            type="button"
                            className="btn-clear-photo"
                            onClick={() => setCatalogForm((cur) => ({ ...cur, image_url: '' }))}
                          >
                            ✕ Hapus Foto
                          </button>
                        )}
                      </div>
                      <input
                        id="cat-image"
                        type="url"
                        className="catalog-url-input"
                        placeholder="Atau tempel tautan URL gambar (https://...)"
                        value={catalogForm.image_url || ''}
                        onChange={(e) => setCatalogForm({ ...catalogForm, image_url: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="supplier-form-field full-width">
                  <label htmlFor="cat-notes">Deskripsi &amp; Catatan Spesifikasi (Opsional)</label>
                  <textarea
                    id="cat-notes"
                    rows={2}
                    style={{ minHeight: '68px' }}
                    placeholder="Spesifikasi teknis, nomor part vendor, atau ketentuan garansi..."
                    value={catalogForm.notes}
                    onChange={(e) => setCatalogForm({ ...catalogForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="field-error" style={{ marginTop: 12 }}>
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
      </dialog>

      {/* Category Management Modal Dialog */}
      <dialog
        ref={categoryDialogRef}
        className="supplier-modal category-manager-modal"
        aria-labelledby="category-manager-title"
        onCancel={() => setCategoryModalOpen(false)}
      >
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
      </dialog>

      {/* Unit Management Modal Dialog */}
      <dialog
        ref={unitDialogRef}
        className="supplier-modal category-manager-modal"
        aria-labelledby="unit-manager-title"
        onCancel={() => setUnitModalOpen(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 id="unit-manager-title" style={{ fontSize: 18, margin: '0 0 4px', color: '#191d17' }}>
                Kelola Satuan Barang
              </h2>
              <p className="modal-subtitle" style={{ margin: 0, fontSize: 13, color: '#555d4e' }}>
                Tambah atau kelola satuan barang gudang (Karung, Dus, Pcs, Box, Pack, dsb.).
              </p>
            </div>
            <button
              type="button"
              className="dashboard-link"
              style={{ fontSize: 18, padding: 4 }}
              onClick={() => setUnitModalOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Notice & Error */}
          {unitNotice && (
            <div
              className="supplier-prefilled-banner"
              style={{ background: '#f0f7ec', borderColor: '#cfe3c5', color: '#2b3910', marginBottom: 14 }}
            >
              <span>✓</span>
              <span>{unitNotice}</span>
            </div>
          )}
          {unitError && (
            <p role="alert" className="field-error" style={{ marginBottom: 14 }}>
              {unitError}
            </p>
          )}

          {/* Form Create / Update Unit */}
          <div className="category-crud-card">
            <div className="category-crud-card-title">
              <span>{unitForm.id ? '✏ Edit Satuan' : '+ Tambah Satuan Baru'}</span>
              {unitForm.id && (
                <span style={{ fontSize: 11, fontWeight: 'normal', color: '#737b6c' }}>
                  (ID: {unitForm.id})
                </span>
              )}
            </div>
            <form onSubmit={handleSaveUnit} noValidate>
              <div className="supplier-form-field" style={{ marginBottom: 14 }}>
                <label htmlFor="unit-form-name">
                  Nama Satuan <span className="required">*</span>
                </label>
                <input
                  id="unit-form-name"
                  placeholder="Contoh: Karung, Dus, Pcs, Box, Sak, Roll, Pail, Pack"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="category-actions-group">
                {unitForm.id && (
                  <button
                    type="button"
                    className="inbound-secondary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleCancelEditUnit}
                    disabled={isSubmittingUnit}
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="inbound-primary"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  disabled={isSubmittingUnit}
                >
                  {isSubmittingUnit
                    ? 'Menyimpan...'
                    : unitForm.id
                    ? 'Simpan Perubahan'
                    : '+ Tambahkan Satuan'}
                </button>
              </div>
            </form>
          </div>

          {/* Units Table */}
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13, color: '#2b3910' }}>
              Daftar Satuan Aktif ({unitsList.length})
            </strong>
          </div>

          <div className="category-list-wrap">
            <table className="category-table">
              <thead>
                <tr>
                  <th style={{ width: '75%' }}>Nama Satuan</th>
                  <th style={{ width: '25%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {unitsList.map((u) => (
                  <tr key={u.id || u.name}>
                    <td>
                      <strong style={{ fontSize: 14 }}>{u.label || u.name}</strong>
                    </td>
                    <td>
                      <div className="category-table-actions">
                        <button
                          type="button"
                          className="btn-cat-action"
                          onClick={() => handleStartEditUnit(u)}
                          title="Edit satuan ini"
                        >
                          ✏ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-cat-action btn-cat-delete"
                          onClick={() => handleDeleteUnit(u)}
                          title="Hapus satuan ini"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {unitsList.length === 0 && (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '16px', color: '#737b6c' }}>
                      Belum ada data satuan. Masukkan nama satuan baru di atas.
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
              onClick={() => setUnitModalOpen(false)}
            >
              Selesai
            </button>
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
          <>
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

            {detailsProduct.image_url && (
              <div style={{ margin: '14px 0', textAlign: 'center' }}>
                <img
                  src={detailsProduct.image_url}
                  alt={detailsProduct.name}
                  style={{
                    maxHeight: 180,
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                    border: '1px solid #dfe4d9',
                    background: '#ffffff',
                    padding: 4,
                  }}
                />
              </div>
            )}

            <div className="catalog-details-grid">
              <div className="catalog-detail-item">
                <dt>Harga Beli Satuan</dt>
                <dd style={{ color: '#2b3910', fontSize: 18 }}>{poMoney(detailsProduct.price || 0)}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Berat Barang</dt>
                <dd>{detailsProduct.weight ? `${detailsProduct.weight} ${detailsProduct.weight_unit || 'kg'}` : '—'}</dd>
              </div>
              <div className="catalog-detail-item">
                <dt>Batas Minimum Order</dt>
                <dd>{detailsProduct.reorder ?? detailsProduct.reorder_level ?? 15} {detailsProduct.unit || 'pcs'}</dd>
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
          </>
        )}
      </dialog>

      {/* Edit Product Modal */}
      <dialog
        ref={productEditDialogRef}
        className="supplier-modal catalog-modal product-edit-modal"
        aria-labelledby="prod-edit-title"
        onCancel={() => setEditProduct(null)}
      >
        {editProduct && (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label htmlFor="edit-prod-category" style={{ margin: 0 }}>
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
                  id="edit-prod-category"
                  value={editProductForm.category_id}
                  onChange={(e) => {
                    const catId = Number(e.target.value);
                    const cat = categories.find((c) => c.id === catId);
                    setEditProductForm((prev) => ({
                      ...prev,
                      category_id: catId,
                      category_name: cat?.name || 'General',
                    }));
                  }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label htmlFor="edit-prod-unit" style={{ margin: 0 }}>
                    Satuan Barang <span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    className="btn-manage-cat-inline"
                    onClick={() => {
                      setUnitError('');
                      setUnitNotice('');
                      setUnitForm({ id: null, name: '' });
                      setUnitModalOpen(true);
                    }}
                    title="Buka panel kelola master satuan produk"
                  >
                    ⚙ Kelola Satuan
                  </button>
                </div>
                <select
                  id="edit-prod-unit"
                  value={editProductForm.unit || ''}
                  onChange={(e) => setEditProductForm({ ...editProductForm, unit: e.target.value })}
                  required
                >
                  {unitsList.length === 0 ? (
                    <option value="" disabled>Belum ada satuan. Klik '⚙ Kelola Satuan' untuk menambah</option>
                  ) : (
                    unitsList.map((u) => (
                      <option key={u.id || u.name} value={u.name}>
                        {u.label || u.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="supplier-form-divider full-width">
                <span>Spesifikasi Pembelian &amp; Satuan</span>
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
                <label htmlFor="edit-prod-reorder">Batas Minimum Order (Unit)</label>
                <input
                  id="edit-prod-reorder"
                  type="number"
                  min="1"
                  step="1"
                  value={editProductForm.reorder}
                  onChange={(e) => setEditProductForm({ ...editProductForm, reorder: e.target.value })}
                />
              </div>

              <div className="supplier-form-field full-width">
                <label htmlFor="edit-prod-weight">Berat Barang (Opsional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="edit-prod-weight"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Contoh: 50"
                    value={editProductForm.weight}
                    onChange={(e) => setEditProductForm({ ...editProductForm, weight: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <select
                    id="edit-prod-weight-unit"
                    value={editProductForm.weight_unit || 'kg'}
                    onChange={(e) => setEditProductForm({ ...editProductForm, weight_unit: e.target.value })}
                    style={{ width: '110px' }}
                  >
                    <option value="kg">kg</option>
                    <option value="gram">gram</option>
                    <option value="ton">ton</option>
                    <option value="liter">liter</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              <div className="supplier-form-divider full-width">
                <span>Foto Produk</span>
              </div>

              <div className="catalog-photo-section">
                <label>Foto Produk</label>
                <div className="catalog-photo-wrap">
                  <div className="catalog-photo-preview-box">
                    {editProductForm.image_url ? (
                      <img
                        src={editProductForm.image_url}
                        alt="Preview Produk"
                        className="catalog-photo-preview-img"
                      />
                    ) : (
                      <div className="catalog-photo-placeholder">
                        <span style={{ fontSize: 24 }}>📦</span>
                        <span>Belum ada foto</span>
                      </div>
                    )}
                  </div>
                  <div className="catalog-photo-inputs">
                    <input
                      type="file"
                      ref={editProductFileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileEdit}
                    />
                    <div className="catalog-photo-actions-row">
                      <button
                        type="button"
                        className="btn-upload-photo"
                        onClick={() => editProductFileInputRef.current?.click()}
                      >
                        📷 Upload Foto dari Perangkat
                      </button>
                      {editProductForm.image_url && (
                        <button
                          type="button"
                          className="btn-clear-photo"
                          onClick={() => setEditProductForm((cur) => ({ ...cur, image_url: '' }))}
                        >
                          ✕ Hapus Foto
                        </button>
                      )}
                    </div>
                    <input
                      id="edit-prod-image"
                      type="url"
                      className="catalog-url-input"
                      placeholder="Atau tempel tautan URL gambar (https://...)"
                      value={editProductForm.image_url || ''}
                      onChange={(e) => setEditProductForm({ ...editProductForm, image_url: e.target.value })}
                    />
                  </div>
                </div>
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
        )}
      </dialog>
    </div>
  );
}
