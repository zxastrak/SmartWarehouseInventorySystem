/**
 * Manage Assets Drawer Component (Sidebar Kanan Kelola Aset)
 * Allows adding and managing Entry Doors, Exit Doors, and Aisles / Walkways.
 */

import React, { useState, useEffect, useRef } from 'react';

export default function ManageAssetsDrawer({
  isOpen,
  warehouse = null,
  walkwayConfig = null,
  existingAssets = [],
  existingAisles = [],
  selectedAssets = [],
  onClose,
  onAddDoor,
  onAddDoorEntry,
  onAddDoorExit,
  onAddDock,
  onAddAisle,
  onUpdateAsset,
  onSelectAsset,
  onDeleteAsset,
  onWalkwayConfigChange,
  isFillDockMode = false,
  onToggleFillDockMode,
  isFillAisleMode = false,
  onToggleFillAisleMode,
  onSaveLayout,
  isSaving = false,
  isDirty = false,
  onEnsureSlotGrid,
  isSlotGridActive = true,
}) {
  const [activeTab, setActiveTab] = useState('door'); // 'door' | 'dock' | 'aisle'
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [editingAssetType, setEditingAssetType] = useState(null); // 'door' | 'dock' | 'aisle'

  const whW = warehouse?.width_mm || 50000;
  const whL = warehouse?.length_mm || 80000;
  const whH = warehouse?.height_mm || 5000;
  const whHeightM = Math.round((whH / 1000) * 10) / 10;
  const minDoorHeightM = 2.0;
  // Maksimal pintu adalah 1.5 meter sebelum ujung atap gudang
  const maxDoorHeightM = Math.max(2.0, Math.round((whHeightM - 1.5) * 10) / 10);

  // Walkway & Forklift Configuration State
  const [localAisleWidthM, setLocalAisleWidthM] = useState(() => Math.max(0.8, Number(walkwayConfig?.aisleWidthM) || 1.0));
  const [hasForklift, setHasForklift] = useState(Boolean(walkwayConfig?.hasForklift));
  const [forkliftLengthM, setForkliftLengthM] = useState(walkwayConfig?.forkliftLengthM || 2.4);
  const [forkliftWidthM, setForkliftWidthM] = useState(walkwayConfig?.forkliftWidthM || 1.2);
  const [forkliftLaneWidthM, setForkliftLaneWidthM] = useState(() => Math.max(2.5, Number(walkwayConfig?.forkliftLaneWidthM || walkwayConfig?.forkliftWidthM) || 2.5));

  useEffect(() => {
    if (walkwayConfig) {
      if (walkwayConfig.aisleWidthM !== undefined) setLocalAisleWidthM(Math.max(0.8, Number(walkwayConfig.aisleWidthM) || 0.8));
      if (walkwayConfig.hasForklift !== undefined) setHasForklift(Boolean(walkwayConfig.hasForklift));
      if (walkwayConfig.forkliftLengthM !== undefined) setForkliftLengthM(walkwayConfig.forkliftLengthM);
      if (walkwayConfig.forkliftWidthM !== undefined) setForkliftWidthM(walkwayConfig.forkliftWidthM);
      if (walkwayConfig.forkliftLaneWidthM !== undefined) setForkliftLaneWidthM(Math.max(2.5, Number(walkwayConfig.forkliftLaneWidthM) || 2.5));
    }
  }, [walkwayConfig]);

  const notifyWalkwayChange = (updates) => {
    const updated = {
      aisleWidthM: Math.max(0.8, Number(localAisleWidthM) || 0.8),
      hasForklift,
      forkliftLengthM: Number(forkliftLengthM) || 2.4,
      forkliftWidthM: Number(forkliftWidthM) || 1.2,
      forkliftLaneWidthM: Math.max(2.5, Number(forkliftLaneWidthM) || 2.5),
      ...updates,
    };
    if (onWalkwayConfigChange) {
      onWalkwayConfigChange(updated);
    }
  };

  // Door State (Masuk, Keluar, Keduanya)
  const [doorType, setDoorType] = useState('door_both'); // 'door_both' | 'door_entry' | 'door_exit'
  const [doorName, setDoorName] = useState('Pintu Utama');
  const [doorWidthM, setDoorWidthM] = useState(3.0);
  const [doorHeightM, setDoorHeightM] = useState(() => Math.min(Math.max(2.0, 2.5), maxDoorHeightM));

  // Dock Area State
  const [dockName, setDockName] = useState('Area Dok Bongkar Muat');
  const [dockWidthM, setDockWidthM] = useState(4.0);
  const [dockLengthM, setDockLengthM] = useState(6.0);

  const handleExpandSide = (direction, amountM = 0.5) => {
    const amountMm = Math.round(amountM * 1000);
    if (editingAssetId && onUpdateAsset) {
      if (editingAssetType === 'aisle' || activeTab === 'aisle') {
        const aisle = (existingAisles || []).find((a) => String(a.id) === String(editingAssetId));
        if (aisle) {
          let newX = aisle.x_mm || 0;
          let newY = aisle.y_mm || 0;
          let newW = aisle.width_mm || 2000;
          let newL = aisle.length_mm || 5000;

          const isFk = aisle.type === 'forklift' || String(aisle.name || '').toLowerCase().includes('forklift') || aisle.direction === 'forklift';
          const isHoriz = (aisle.width_mm || 2000) >= (aisle.length_mm || 5000);

          if (isFk) {
            // "kunci lebar forklift sesuai dengan yang diinput oleh user, jadi khusus forklift tidak bisa membesar atau mengecil"
            // Hanya panjang koridor jalan yang dapat dilebarkan, lebar penampang dikunci
            if (isHoriz && (direction === 'top' || direction === 'bottom')) return;
            if (!isHoriz && (direction === 'left' || direction === 'right')) return;
          }

          if (direction === 'left') {
            newX = Math.max(0, newX - amountMm);
            newW = aisle.width_mm + (aisle.x_mm - newX);
          } else if (direction === 'right') {
            newW = newW + amountMm;
          } else if (direction === 'top') {
            newY = Math.max(0, newY - amountMm);
            newL = aisle.length_mm + (aisle.y_mm - newY);
          } else if (direction === 'bottom') {
            newL = newL + amountMm;
          }

          if (isFk) {
            if (isHoriz) newL = aisle.length_mm;
            else newW = aisle.width_mm;
          }

          const wM = Math.round((newW / 1000) * 10) / 10;
          const lM = Math.round((newL / 1000) * 10) / 10;
          setAisleWidthM(wM);
          setAisleLengthM(lM);

          onUpdateAsset('aisle', editingAssetId, {
            x_mm: newX,
            y_mm: newY,
            width_mm: newW,
            length_mm: newL,
          });
          return;
        }
      }

      const dock = (existingAssets || []).find((a) => String(a.id) === String(editingAssetId));
      if (dock) {
        let newX = dock.x_mm || 0;
        let newY = dock.y_mm || 0;
        let newW = dock.width_mm || 4000;
        let newL = dock.length_mm || 6000;

        if (direction === 'left') {
          newX = Math.max(0, newX - amountMm);
          newW = dock.width_mm + (dock.x_mm - newX);
        } else if (direction === 'right') {
          newW = newW + amountMm;
        } else if (direction === 'top') {
          newY = Math.max(0, newY - amountMm);
          newL = dock.length_mm + (dock.y_mm - newY);
        } else if (direction === 'bottom') {
          newL = newL + amountMm;
        }

        const wM = Math.round((newW / 1000) * 10) / 10;
        const lM = Math.round((newL / 1000) * 10) / 10;
        setDockWidthM(wM);
        setDockLengthM(lM);

        onUpdateAsset('layout_object', editingAssetId, {
          x_mm: newX,
          y_mm: newY,
          width_mm: newW,
          length_mm: newL,
        });
        return;
      }
    }

    if (direction === 'left' || direction === 'right') {
      const newW = Math.max(1.0, Math.round((Number(dockWidthM) + amountM) * 10) / 10);
      setDockWidthM(newW);
      if (isFillDockMode && onToggleFillDockMode) {
        onToggleFillDockMode({ name: dockName, widthM: newW, lengthM: dockLengthM });
      }
    } else {
      const newL = Math.max(1.0, Math.round((Number(dockLengthM) + amountM) * 10) / 10);
      setDockLengthM(newL);
      if (isFillDockMode && onToggleFillDockMode) {
        onToggleFillDockMode({ name: dockName, widthM: dockWidthM, lengthM: newL });
      }
    }
  };

  // Aisle State
  const [selectedAisleType, setSelectedAisleType] = useState('standard'); // 'standard' | 'forklift'
  const [aisleCode, setAisleCode] = useState('');
  const [aisleName, setAisleName] = useState('Jalur Standar');
  const [aisleWidthM, setAisleWidthM] = useState(1.5);
  const [aisleLengthM, setAisleLengthM] = useState(5.0);
  const [aisleDirection, setAisleDirection] = useState('two_way');
  const [showAllAssets, setShowAllAssets] = useState(false);

  const handleSelectAisleType = (type) => {
    setSelectedAisleType(type);
    let newName = 'Jalur Standar';
    let newWidth = localAisleWidthM;
    let newDir = 'two_way';
    if (type === 'forklift') {
      if (!hasForklift) {
        setHasForklift(true);
        notifyWalkwayChange({ hasForklift: true });
      }
      newName = 'Jalur Forklift';
      newWidth = forkliftLaneWidthM;
      newDir = 'forklift';
      setAisleName('Jalur Forklift');
      setAisleWidthM(forkliftLaneWidthM);
      setAisleDirection('forklift');
    } else if (type === 'pedestrian') {
      newName = 'Jalur Penghubung';
      newWidth = 1.0;
      newDir = 'two_way';
      setAisleName('Jalur Penghubung');
      setAisleWidthM(1.0);
      setAisleDirection('two_way');
    } else {
      setAisleName('Jalur Standar');
      setAisleWidthM(localAisleWidthM);
      setAisleDirection('two_way');
    }
    if (isFillAisleMode && onToggleFillAisleMode) {
      onToggleFillAisleMode(
        {
          type,
          name: newName,
          code: aisleCode.trim() || (type === 'forklift' ? 'FK' : type === 'pedestrian' ? 'P' : 'A'),
          widthM: Number(newWidth) || (type === 'forklift' ? forkliftLaneWidthM : type === 'pedestrian' ? 1.0 : localAisleWidthM),
          direction: newDir,
        },
        true
      );
    }
  };

  const prevSelectedIdRef = useRef(null);

  // Reset tab ke default dan pastikan mode gambar jalan nonaktif saat drawer ditutup
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('door');
      setEditingAssetId(null);
      setEditingAssetType(null);
      prevSelectedIdRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const first = selectedAssets && selectedAssets.length > 0 ? selectedAssets[0] : null;
      const firstId = first ? String(first.id) : null;
      if (firstId && firstId !== prevSelectedIdRef.current) {
        prevSelectedIdRef.current = firstId;
        const t = String(first.object_type || first.type || '').toLowerCase();
        const isDoor = t.includes('door') || t.includes('entry') || t.includes('exit');
        const isDock = t.includes('dock');
        const isAisle = first.aisle_code !== undefined || t.includes('aisle');

        setEditingAssetId(first.id);
        if (isDoor) {
          setEditingAssetType('door');
          setActiveTab('door');
          setDoorName(first.name || 'Pintu');
          setDoorType(first.object_type || 'door_both');
          const maxDim = Math.max(Number(first.width_mm) || 3000, Number(first.length_mm) || 600);
          setDoorWidthM(Math.round((maxDim / 1000) * 10) / 10);
          setDoorHeightM(Math.round(((Number(first.height_mm) || 2500) / 1000) * 10) / 10);
        } else if (isDock) {
          setEditingAssetType('dock');
          setActiveTab('dock');
          setDockName(first.name || 'Area Dok');
          setDockWidthM(Math.round(((Number(first.width_mm) || 4000) / 1000) * 10) / 10);
          setDockLengthM(Math.round(((Number(first.length_mm) || 6000) / 1000) * 10) / 10);
        } else if (isAisle) {
          setEditingAssetType('aisle');
          setActiveTab('aisle');
          setAisleCode(first.aisle_code || '');
          setAisleName(first.name || 'Jalur Standar');
          const isFk = first.direction === 'forklift' || String(first.type || '').includes('forklift');
          setSelectedAisleType(isFk ? 'forklift' : 'standard');
          setAisleWidthM(Math.round(((Number(first.width_mm) || 1500) / 1000) * 10) / 10);
          setAisleLengthM(Math.round(((Number(first.length_mm) || 5000) / 1000) * 10) / 10);
          setAisleDirection(first.direction || (isFk ? 'forklift' : 'two_way'));
        }
      } else if (!firstId) {
        prevSelectedIdRef.current = null;
      }
    }
  }, [isOpen, selectedAssets]);

  const handleSelectExistingAsset = (item) => {
    setEditingAssetId(item.id);
    const t = String(item.object_type || item.type || '').toLowerCase();
    const isDoor = t.includes('door') || t.includes('entry') || t.includes('exit');
    const isDock = t.includes('dock');
    const isAisle = item.aisle_code !== undefined || t.includes('aisle');

    if (isDoor) {
      setEditingAssetType('door');
      setActiveTab('door');
      setDoorName(item.name || 'Pintu');
      setDoorType(item.object_type || 'door_both');
      const maxDim = Math.max(Number(item.width_mm) || 3000, Number(item.length_mm) || 600);
      setDoorWidthM(Math.round((maxDim / 1000) * 10) / 10);
      setDoorHeightM(Math.round(((Number(item.height_mm) || 2500) / 1000) * 10) / 10);
      if (onSelectAsset) onSelectAsset('layout_object', item.id);
    } else if (isDock) {
      setEditingAssetType('dock');
      setActiveTab('dock');
      setDockName(item.name || 'Area Dok');
      setDockWidthM(Math.round(((Number(item.width_mm) || 4000) / 1000) * 10) / 10);
      setDockLengthM(Math.round(((Number(item.length_mm) || 6000) / 1000) * 10) / 10);
      if (onSelectAsset) onSelectAsset('layout_object', item.id);
    } else if (isAisle) {
      setEditingAssetType('aisle');
      setActiveTab('aisle');
      setAisleCode(item.aisle_code || '');
      setAisleName(item.name || 'Jalur Standar');
      const isFk = item.direction === 'forklift' || String(item.type || '').includes('forklift');
      setSelectedAisleType(isFk ? 'forklift' : 'standard');
      setAisleWidthM(Math.round(((Number(item.width_mm) || 1500) / 1000) * 10) / 10);
      setAisleLengthM(Math.round(((Number(item.length_mm) || 5000) / 1000) * 10) / 10);
      setAisleDirection(item.direction || (isFk ? 'forklift' : 'two_way'));
      if (onSelectAsset) onSelectAsset('aisle', item.id);
    }
  };

  const handleSaveClick = (e) => {
    if (e) e.preventDefault();
    if (editingAssetId) {
      if (editingAssetType === 'door' || activeTab === 'door') {
        if (onUpdateAsset) {
          const currentDoor = (existingAssets || []).find((a) => String(a.id) === String(editingAssetId));
          const isVerticalWall = currentDoor && (Number(currentDoor.length_mm) || 0) > (Number(currentDoor.width_mm) || 0);
          const span_mm = Math.max(1000, Math.round(Number(doorWidthM) * 1000));
          const clampedH = Math.min(Math.max(minDoorHeightM, Number(doorHeightM) || 2.0), maxDoorHeightM);
          const height_mm = Math.round(clampedH * 1000);

          onUpdateAsset('layout_object', editingAssetId, {
            name: doorName.trim() || 'Pintu',
            object_type: doorType,
            width_mm: isVerticalWall ? 600 : span_mm,
            length_mm: isVerticalWall ? span_mm : 600,
            height_mm,
          });
        }
      } else if (editingAssetType === 'dock' || activeTab === 'dock') {
        if (onUpdateAsset) {
          onUpdateAsset('layout_object', editingAssetId, {
            name: dockName.trim() || 'Dok Muat',
            width_mm: Math.max(1000, Math.round(Number(dockWidthM) * 1000)),
            length_mm: Math.max(1000, Math.round(Number(dockLengthM) * 1000)),
          });
        }
      } else if (editingAssetType === 'aisle' || activeTab === 'aisle') {
        const isFk = selectedAisleType === 'forklift';
        const targetWidthM = Number(aisleWidthM) || (isFk ? forkliftLaneWidthM : localAisleWidthM);
        const targetLengthM = Number(aisleLengthM) || 5.0;
        if (onUpdateAsset) {
          onUpdateAsset('aisle', editingAssetId, {
            name: aisleName.trim() || (isFk ? 'Jalur Forklift' : 'Jalur Standar'),
            aisle_code: aisleCode.trim(),
            width_mm: Math.max(300, Math.round(targetWidthM * 1000)),
            length_mm: Math.max(300, Math.round(targetLengthM * 1000)),
            direction: isFk ? 'forklift' : (aisleDirection || 'two_way'),
          });
        }
      }
    } else {
      if (onSaveLayout) onSaveLayout();
    }
  };

  const handleClose = () => {
    if (isFillAisleMode && onToggleFillAisleMode) {
      onToggleFillAisleMode(null, false);
    }
    if (isFillDockMode && onToggleFillDockMode) {
      onToggleFillDockMode(null, false);
    }
    setEditingAssetId(null);
    setEditingAssetType(null);
    setActiveTab('door');
    if (onClose) onClose();
  };

  const handleSelectDoorTab = () => {
    setActiveTab('door');
    if (editingAssetType && editingAssetType !== 'door') {
      setEditingAssetId(null);
      setEditingAssetType(null);
    }
    if (isFillAisleMode && onToggleFillAisleMode) {
      onToggleFillAisleMode(null, false);
    }
    if (isFillDockMode && onToggleFillDockMode) {
      onToggleFillDockMode(null, false);
    }
  };

  const handleSelectDockTab = () => {
    setActiveTab('dock');
    if (editingAssetType && editingAssetType !== 'dock') {
      setEditingAssetId(null);
      setEditingAssetType(null);
    }
    if (isFillAisleMode && onToggleFillAisleMode) {
      onToggleFillAisleMode(null, false);
    }
  };

  const handleSelectAisleTab = () => {
    setActiveTab('aisle');
    if (editingAssetType && editingAssetType !== 'aisle') {
      setEditingAssetId(null);
      setEditingAssetType(null);
    }
    if (isFillDockMode && onToggleFillDockMode) {
      onToggleFillDockMode(null, false);
    }
  };

  if (!isOpen) return null;

  const handleCreateDoor = (e) => {
    if (e) e.preventDefault();
    if (editingAssetId) {
      handleSaveClick(e);
      return;
    }
    const width_mm = Math.max(1000, Math.round(Number(doorWidthM) * 1000));
    const length_mm = 600; // tebal kusen dinding
    const clampedH = Math.min(Math.max(minDoorHeightM, Number(doorHeightM) || 2.0), maxDoorHeightM);
    const height_mm = Math.round(clampedH * 1000);

    // Otomatis menempel pada dinding (default dinding bawah gudang jika pasang via tombol)
    const x_mm = Math.max(1000, Math.round((whW - width_mm) / 2));
    const y_mm = Math.max(0, whL - length_mm);

    const defaultTitle = doorType === 'door_both'
      ? 'Pintu Akses Utama'
      : doorType === 'door_exit'
      ? 'Pintu Keluar Outbound'
      : 'Pintu Masuk Inbound';

    const payload = {
      name: doorName.trim() || defaultTitle,
      object_type: doorType,
      width_mm,
      length_mm,
      height_mm,
      x_mm,
      y_mm,
      clearance_mm: 500,
    };

    if (onAddDoor) {
      onAddDoor(payload);
    } else if (doorType === 'door_exit' && onAddDoorExit) {
      onAddDoorExit(payload);
    } else if (onAddDoorEntry) {
      onAddDoorEntry(payload);
    }
    if (onSaveLayout) {
      setTimeout(() => onSaveLayout(), 120);
    }
  };

  const handleCreateAisle = (e) => {
    if (e) e.preventDefault();
    if (editingAssetId) {
      handleSaveClick(e);
      return;
    }
    if (onEnsureSlotGrid) onEnsureSlotGrid();
    const isForklift = selectedAisleType === 'forklift';
    const prefix = isForklift ? 'FK' : 'A';
    const usedNums = existingAisles
      .map((a) => {
        const m = (a.aisle_code || '').match(new RegExp(`^${prefix}-(\\d+)$`));
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const nextNum = (usedNums.length > 0 ? Math.max(...usedNums) : 0) + 1;
    const finalCode = aisleCode.trim() || `${prefix}-${String(nextNum).padStart(2, '0')}`;
    const minM = isForklift ? 2.5 : 0.8;
    const targetWidthM = Math.max(minM, Number(aisleWidthM) || (isForklift ? forkliftLaneWidthM : localAisleWidthM));
    const width_mm = Math.round(targetWidthM * 1000);
    // Panjang jalan otomatis default ke kanvas / 12m tanpa perlu input manual
    const length_mm = Math.max(2000, Math.min(whL, 12000));

    if (onAddAisle) {
      onAddAisle({
        aisle_code: finalCode,
        name: aisleName.trim() || (isForklift ? `Jalur Forklift ${nextNum}` : `Jalur Standar ${nextNum}`),
        width_mm,
        length_mm,
        x_mm: 3000,
        y_mm: 3000,
        direction: isForklift ? 'forklift' : (aisleDirection || 'two_way'),
      });
    }
    if (onSaveLayout) {
      setTimeout(() => onSaveLayout(), 120);
    }
  };

  const handleCreateDock = (e) => {
    if (e) e.preventDefault();
    if (editingAssetId) {
      handleSaveClick(e);
      return;
    }
    const width_mm = Math.max(1000, Math.round(Number(dockWidthM) * 1000));
    const length_mm = Math.max(1000, Math.round(Number(dockLengthM) * 1000));

    const x_mm = Math.max(1000, Math.round((whW - width_mm) / 2));
    const y_mm = Math.max(0, whL - length_mm);

    if (onAddDock) {
      onAddDock({
        name: dockName.trim() || 'Dok Standar',
        object_type: 'dock',
        width_mm,
        length_mm,
        x_mm,
        y_mm,
        clearance_mm: 500,
      });
    }
    if (onSaveLayout) {
      setTimeout(() => onSaveLayout(), 120);
    }
  };

  const handleDragStart = (e, assetType, customProps = {}) => {
    const isDoor = assetType === 'door' || assetType === 'door_both' || assetType === 'door_entry' || assetType === 'door_exit';
    const isForklift = assetType === 'forklift_aisle' || (assetType === 'aisle' && selectedAisleType === 'forklift');
    const isDock = assetType === 'dock';
    const activeAisleWidthM = isForklift
      ? (selectedAisleType === 'forklift' ? aisleWidthM : forkliftLaneWidthM)
      : (selectedAisleType === 'standard' ? aisleWidthM : localAisleWidthM);

    const actualType = isDoor ? (assetType === 'door' ? doorType : assetType) : (isForklift ? 'forklift_aisle' : assetType);

    const defaultDoorTitle = doorType === 'door_both'
      ? 'Pintu Masuk & Keluar'
      : doorType === 'door_exit'
      ? 'Pintu Keluar'
      : 'Pintu Masuk';

    const payload = {
      type: actualType,
      name:
        customProps.name ||
        (isDoor
          ? doorName || defaultDoorTitle
          : isDock
          ? dockName || 'Area Dok Muat'
          : isForklift
          ? 'Jalur Forklift'
          : aisleName || 'Jalur Standar'),
      width_mm:
        customProps.width_mm ||
        (isDoor
          ? Math.max(1000, Math.round(Number(doorWidthM) * 1000))
          : isDock
          ? Math.max(2000, Math.round(Number(dockWidthM) * 1000))
          : Math.max(300, Math.round(Number(activeAisleWidthM) * 1000))),
      length_mm:
        customProps.length_mm ||
        (isDock
          ? Math.max(2000, Math.round(Number(dockLengthM) * 1000))
          : assetType === 'aisle' || isForklift
          ? 12000
          : 600),
      height_mm: isDoor ? Math.round((Number(doorHeightM) || 2.5) * 1000) : undefined,
      direction: isForklift ? 'forklift' : (aisleDirection || 'two_way'),
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="layout-drawer-panel"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '440px',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '-6px 0 20px rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '1.1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafaf9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>🏛️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#191d17' }}>
              Tata Aset
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#737b6c' }}>
              Edit properti pintu, dok, dan jalur jalan terpilih
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#64748b',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
          title="Tutup"
        >
          ✕
        </button>
      </div>

      {/* Tabs directly below Drawer Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          padding: '8px 10px',
          backgroundColor: '#f1f5f9',
          gap: '6px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <button
          type="button"
          onClick={handleSelectDoorTab}
          style={{
            padding: '8px 6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'door' ? '#ffffff' : 'transparent',
            color: activeTab === 'door' ? '#0f766e' : '#64748b',
            boxShadow: activeTab === 'door' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🚪 Pintu
        </button>
        <button
          type="button"
          onClick={handleSelectDockTab}
          style={{
            padding: '8px 6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'dock' ? '#ffffff' : 'transparent',
            color: activeTab === 'dock' ? '#1d4ed8' : '#64748b',
            boxShadow: activeTab === 'dock' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🚛 Dok
        </button>
        <button
          type="button"
          onClick={handleSelectAisleTab}
          style={{
            padding: '8px 6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'aisle' ? '#ffffff' : 'transparent',
            color: activeTab === 'aisle' ? '#854d0e' : '#64748b',
            boxShadow: activeTab === 'aisle' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🛣️ Jalan
        </button>
      </div>

      {/* Drawer Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {/* Active Selection Banner */}
        {editingAssetId ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                ✏️ Mengedit {activeTab === 'door' ? 'Pintu' : activeTab === 'dock' ? 'Dok' : 'Jalan'}:{' '}
                {activeTab === 'door' ? doorName : activeTab === 'dock' ? dockName : (aisleCode || aisleName)}
              </span>
              <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 1 }}>
                Sesuaikan properti di bawah lalu klik tombol "Simpan"
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAssetId(null);
                setEditingAssetType(null);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                borderRadius: '5px',
                border: '1px solid #86efac',
                backgroundColor: '#ffffff',
                color: '#166534',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Batal Pilih
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
              Pilih aset di kanvas atau dari <strong>Daftar Aset Terpasang</strong> di bawah untuk mengedit propertinya.
            </span>
          </div>
        )}
        {/* TAB 1: PINTU (MASUK, KELUAR, KEDUANYA) */}
        {activeTab === 'door' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: doorType === 'door_both' ? '#eff6ff' : doorType === 'door_exit' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${doorType === 'door_both' ? '#bfdbfe' : doorType === 'door_exit' ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: doorType === 'door_both' ? '#1d4ed8' : doorType === 'door_exit' ? '#991b1b' : '#166534',
                  marginBottom: 2,
                }}
              >
                {doorType === 'door_both'
                  ? '🚪 Pintu Akses (Masuk & Keluar / Dua Arah)'
                  : doorType === 'door_exit'
                  ? '🚪 Pintu Keluar Barang (Outbound Exit)'
                  : '🚪 Pintu Masuk Barang (Inbound Entry)'}
              </div>
              <div
                style={{
                  fontSize: '0.76rem',
                  color: doorType === 'door_both' ? '#1e40af' : doorType === 'door_exit' ? '#b91c1c' : '#15803d',
                  lineHeight: 1.4,
                }}
              >
                {doorType === 'door_both'
                  ? 'Titik akses terpadu armada dan staf untuk proses masuk sekaligus keluar gudang.'
                  : doorType === 'door_exit'
                  ? 'Titik pelepasan kargo outbound atau pintu darurat evakuasi gudang.'
                  : 'Titik akses masuk armada truk dan personil inbound ke area gudang.'}
              </div>
            </div>

            {/* Contextual Drag Card */}
            <div
              draggable={true}
              onDragStart={(e) => handleDragStart(e, 'door')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                backgroundColor: '#ffffff',
                border: `2px dashed ${doorType === 'door_both' ? '#3b82f6' : doorType === 'door_exit' ? '#f87171' : '#22c55e'}`,
                borderRadius: '8px',
                cursor: 'grab',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              title="Klik & tarik kartu ini ke kanvas denah gudang untuk menempatkan Pintu"
            >
              <div style={{ fontSize: '1.6rem' }}>🚪</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: doorType === 'door_both' ? '#1d4ed8' : doorType === 'door_exit' ? '#991b1b' : '#166534',
                  }}
                >
                  🖐️ Tarik Pintu ke Kanvas
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>
                  {doorWidthM}m (L) × {doorHeightM}m (T) • Otomatis nempel pada dinding denah
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: doorType === 'door_both' ? '#dbeafe' : doorType === 'door_exit' ? '#fee2e2' : '#dcfce7',
                  color: doorType === 'door_both' ? '#1d4ed8' : doorType === 'door_exit' ? '#991b1b' : '#166534',
                  padding: '3px 8px',
                  borderRadius: '4px',
                }}
              >
                Drag &amp; Drop
              </span>
            </div>

            <form onSubmit={handleCreateDoor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Fungsi / Jenis Pintu:
                <select
                  value={doorType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDoorType(val);
                    if (!editingAssetId) {
                      if (val === 'door_both') setDoorName('Pintu Masuk & Keluar');
                      else if (val === 'door_entry') setDoorName('Pintu Masuk Inbound');
                      else if (val === 'door_exit') setDoorName('Pintu Keluar Outbound');
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}
                >
                  <option value="door_both">🚪 Pintu Masuk &amp; Keluar (Akses Keduanya / Dua Arah)</option>
                  <option value="door_entry">🚪 Pintu Masuk Saja (Inbound Entry)</option>
                  <option value="door_exit">🚪 Pintu Keluar Saja (Outbound Exit)</option>
                </select>
              </label>

              {/* Opsi Lebarkan Salah Satu Sisi Jalan */}
              {(() => {
                const curAisle = editingAssetId ? (existingAisles || []).find((a) => String(a.id) === String(editingAssetId)) : null;
                const isFk = curAisle
                  ? (curAisle.type === 'forklift' || String(curAisle.name || '').toLowerCase().includes('forklift') || curAisle.direction === 'forklift')
                  : (aisleDirection === 'forklift');
                const isHoriz = curAisle ? ((curAisle.width_mm || 2000) >= (curAisle.length_mm || 5000)) : true;
                const lockedWidthM = curAisle
                  ? ((isHoriz ? curAisle.length_mm : curAisle.width_mm) / 1000).toFixed(1)
                  : aisleWidthM;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Lebarkan Salah Satu Sisi Jalan:
                    </span>
                    {isFk && (
                      <div style={{ padding: '6px 10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.74rem', color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔒 Lebar jalur forklift ({lockedWidthM}m) dikunci sesuai input (hanya panjang lorong yang dapat diubah)</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button
                          type="button"
                          disabled={isFk && !isHoriz}
                          onClick={() => handleExpandSide('left', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && !isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && !isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && !isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && !isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && !isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && !isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah kiri (+0.5m)'}
                        >
                          ⬅️ Sisi Kiri (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && !isHoriz}
                          onClick={() => handleExpandSide('right', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && !isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && !isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && !isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && !isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && !isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && !isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah kanan (+0.5m)'}
                        >
                          ➡️ Sisi Kanan (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && isHoriz}
                          onClick={() => handleExpandSide('top', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah atas (+0.5m)'}
                        >
                          ⬆️ Sisi Atas (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && isHoriz}
                          onClick={() => handleExpandSide('bottom', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah bawah (+0.5m)'}
                        >
                          ⬇️ Sisi Bawah (+0.5m)
                        </button>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                        💡 Tip: Anda juga dapat langsung menarik handle kotak di ujung jalan pada kanvas untuk memperpanjang/memperpendek lorong.
                      </div>
                    </div>
                  </div>
                );
              })()}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Nama Pintu:
                <input
                  type="text"
                  value={doorName}
                  onChange={(e) => setDoorName(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  placeholder="Contoh: Pintu Akses Dok Utama"
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  Lebar Pintu (Meter):
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.5"
                      value={doorWidthM}
                      onChange={(e) => setDoorWidthM(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                      required
                    />
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>m</span>
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  Tinggi Pintu (Meter):
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={minDoorHeightM}
                      max={maxDoorHeightM}
                      step="0.1"
                      value={doorHeightM}
                      onChange={(e) => setDoorHeightM(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                      required
                    />
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>m</span>
                  </div>
                </label>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: -4 }}>
                💡 Minimal 2.0m, maksimal {maxDoorHeightM}m (1.5m sebelum ujung atap gudang {whHeightM}m). Pintu otomatis nempel pada dinding.
              </span>

              {editingAssetId ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    title="Simpan pembaruan ukuran & spesifikasi pintu ini"
                  >
                    💾 Simpan Perubahan Pintu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssetId(null);
                      setEditingAssetType(null);
                      setDoorName('Pintu Masuk & Keluar');
                    }}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Batal edit dan beralih ke mode pasang pintu baru"
                  >
                    + Pintu Baru
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  style={{
                    marginTop: 6,
                    padding: '10px 16px',
                    backgroundColor: doorType === 'door_both' ? '#2563eb' : doorType === 'door_exit' ? '#dc2626' : '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  + Tambah Pintu Baru ke Dinding
                </button>
              )}
            </form>
          </div>
        )}

        {/* TAB 3: AREA DOCKING */}
        {activeTab === 'dock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1d4ed8', marginBottom: 2 }}>
                Area Dok Bongkar Muat (Loading / Unloading Dock)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563eb', lineHeight: 1.4 }}>
                Area parkir armada truk logistik untuk proses bongkar muat barang gudang.
              </div>
            </div>

            {/* Toggle Mode Drag & Fill Dok (Canvas Drag) */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: isFillDockMode ? '#eff6ff' : '#f8fafc',
                border: isFillDockMode ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isFillDockMode ? '#1d4ed8' : '#334155' }}>
                  🖊️ Mode Drag &amp; Fill Dok: {isFillDockMode ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                  Klik &amp; seret mouse di kanvas untuk menggambar kotak area dok muat
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onToggleFillDockMode) {
                    onToggleFillDockMode({
                      name: dockName.trim() || 'Dok Standar',
                      widthM: Number(dockWidthM) || 4,
                      lengthM: Number(dockLengthM) || 6,
                    });
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isFillDockMode ? '#2563eb' : '#64748b',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isFillDockMode ? '0 2px 6px rgba(37,99,235,0.35)' : 'none',
                }}
              >
                {isFillDockMode ? 'Matikan' : 'Aktifkan Fill'}
              </button>
            </div>

            <form onSubmit={handleCreateDock} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Nama Dok / Area:
                <input
                  type="text"
                  value={dockName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDockName(val);
                    if (isFillDockMode && onToggleFillDockMode) {
                      onToggleFillDockMode({
                        name: val.trim() || 'Dok Standar',
                        widthM: Number(dockWidthM) || 4,
                        lengthM: Number(dockLengthM) || 6,
                      });
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  placeholder="Contoh: Area Dok Bongkar Muat"
                />
              </label>

              {/* Pengaturan Ukuran & Dimensi Dok */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1rem' }}>📐</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      Dimensi Dok Bongkar Muat
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    Luas: {(Number(dockWidthM) * Number(dockLengthM)).toFixed(1)} m²
                  </span>
                </div>

                {/* Kontrol Lebar & Panjang */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Lebar (Horizontal) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>
                      Lebar Horizontal (m)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newW = Math.max(1.0, Math.round((Number(dockWidthM) - 0.5) * 10) / 10);
                          setDockWidthM(newW);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              width_mm: Math.round(newW * 1000),
                            });
                          }
                        }}
                        style={{
                          width: 30,
                          height: 34,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={dockWidthM}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setDockWidthM(val);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              width_mm: Math.round(val * 1000),
                            });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newW = Math.round((Number(dockWidthM) + 0.5) * 10) / 10;
                          setDockWidthM(newW);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              width_mm: Math.round(newW * 1000),
                            });
                          }
                        }}
                        style={{
                          width: 30,
                          height: 34,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Panjang (Vertikal) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>
                      Panjang Vertikal (m)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newL = Math.max(1.0, Math.round((Number(dockLengthM) - 0.5) * 10) / 10);
                          setDockLengthM(newL);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              length_mm: Math.round(newL * 1000),
                            });
                          }
                        }}
                        style={{
                          width: 30,
                          height: 34,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={dockLengthM}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setDockLengthM(val);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              length_mm: Math.round(val * 1000),
                            });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newL = Math.round((Number(dockLengthM) + 0.5) * 10) / 10;
                          setDockLengthM(newL);
                          if (editingAssetId && onUpdateAsset) {
                            onUpdateAsset('layout_object', editingAssetId, {
                              length_mm: Math.round(newL * 1000),
                            });
                          }
                        }}
                        style={{
                          width: 30,
                          height: 34,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bagian: Melebarkan Salah Satu Sisi Dok */}
                <div
                  style={{
                    marginTop: 4,
                    padding: '10px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                      ↔️ Opsi Melebarkan Salah Satu Sisi:
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Langkah +0.5m
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleExpandSide('left', 0.5)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title="Lebarkan dok ke arah kiri (+0.5m)"
                    >
                      ⬅️ Sisi Kiri (+0.5m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandSide('right', 0.5)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title="Lebarkan dok ke arah kanan (+0.5m)"
                    >
                      ➡️ Sisi Kanan (+0.5m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandSide('top', 0.5)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title="Lebarkan dok ke arah atas (+0.5m)"
                    >
                      ⬆️ Sisi Atas (+0.5m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandSide('bottom', 0.5)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title="Lebarkan dok ke arah bawah (+0.5m)"
                    >
                      ⬇️ Sisi Bawah (+0.5m)
                    </button>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                    💡 Tip: Anda juga dapat langsung menarik salah satu dari 8 titik (handle) kotak di tepi Dok pada kanvas untuk melebarkan sisi yang diinginkan.
                  </div>
                </div>
              </div>

              {editingAssetId ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    title="Simpan pembaruan ukuran & spesifikasi area dok ini"
                  >
                    💾 Simpan Perubahan Dok
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssetId(null);
                      setEditingAssetType(null);
                      setDockName('Dok Standar');
                    }}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Batal edit dan beralih ke mode tambah area dok baru"
                  >
                    + Dok Baru
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  style={{
                    marginTop: 6,
                    padding: '10px 16px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  + Tambah Area Dok Baru
                </button>
              )}
            </form>
          </div>
        )}

        {/* TAB 4: JALAN / LORONG */}
        {activeTab === 'aisle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Notifikasi Peringatan: Muncul hanya ketika ingin menambahkan jalan tetapi grid slot tidak aktif */}
            {!isSlotGridActive && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  color: '#92400e',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.95rem' }}>⚠️</span>
                  <span>Grid slot belum aktif untuk panduan membuat jalan</span>
                </div>
                {onEnsureSlotGrid && (
                  <button
                    type="button"
                    onClick={onEnsureSlotGrid}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(217,119,6,0.3)',
                    }}
                  >
                    Aktifkan Grid
                  </button>
                )}
              </div>
            )}

            {/* Toggle Mode Drag & Fill Jalan (Canvas Drag) */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: isFillAisleMode ? '#fefce8' : '#f8fafc',
                border: isFillAisleMode ? '2px solid #d97706' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isFillAisleMode ? '#b45309' : '#334155' }}>
                  🖊️ Mode Drag &amp; Fill Jalan: {isFillAisleMode ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                  Klik &amp; seret mouse di kanvas untuk menggambar jalur lorong / jalan
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onToggleFillAisleMode) {
                    onToggleFillAisleMode({
                      type: selectedAisleType,
                      name: aisleName.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
                      code: aisleCode.trim() || (selectedAisleType === 'forklift' ? 'FK' : 'A'),
                      widthM: Number(aisleWidthM) || (selectedAisleType === 'forklift' ? forkliftLaneWidthM : localAisleWidthM),
                      direction: aisleDirection,
                    });
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isFillAisleMode ? '#d97706' : '#64748b',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isFillAisleMode ? '0 2px 6px rgba(217,119,6,0.35)' : 'none',
                }}
              >
                {isFillAisleMode ? 'Matikan' : 'Aktifkan Fill'}
              </button>
            </div>

            {/* Konfigurasi Lebar Jalan Manusia & Forklift */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                  🚶 Standar &amp; Akses Jalan
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: hasForklift ? '#fef3c7' : '#f1f5f9',
                    color: hasForklift ? '#92400e' : '#64748b',
                  }}
                >
                  {hasForklift ? '🚜 Forklift Aktif' : '🚶 Personil Saja'}
                </span>
              </div>

              {/* Jarak Jalan Manusia */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '7px 10px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: Number(localAisleWidthM) < 0.8 ? '1px solid #f87171' : '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                      Lebar Jalur Manusia:
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Standar personil &amp; troli (min. 0.8m)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      value={localAisleWidthM}
                      step="0.1"
                      min="0.8"
                      max="10"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setLocalAisleWidthM(raw);
                        const num = parseFloat(raw);
                        if (!isNaN(num) && num >= 0.8) {
                          notifyWalkwayChange({ aisleWidthM: num });
                        }
                      }}
                      onBlur={() => {
                        const num = parseFloat(localAisleWidthM);
                        const clamped = isNaN(num) || num < 0.8 ? 0.8 : Math.min(10, num);
                        setLocalAisleWidthM(clamped);
                        notifyWalkwayChange({ aisleWidthM: clamped });
                      }}
                      style={{
                        width: '56px',
                        padding: '4px 6px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: Number(localAisleWidthM) < 0.8 ? '1px solid #ef4444' : '1px solid #cbd5e1',
                        color: Number(localAisleWidthM) < 0.8 ? '#b91c1c' : '#1e293b',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>m</span>
                  </div>
                </div>
                {Number(localAisleWidthM) < 0.8 && (
                  <div style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ Lebar jalur manusia minimal 0.8m (80 cm) sebagai batas limit keselamatan sirkulasi personil.
                  </div>
                )}
              </div>

              {/* Akses Forklift Toggle */}
              <div
                style={{
                  padding: '7px 10px',
                  backgroundColor: hasForklift ? '#fffbeb' : '#ffffff',
                  borderRadius: '6px',
                  border: hasForklift ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={hasForklift}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasForklift(checked);
                        notifyWalkwayChange({ hasForklift: checked });
                        if (checked && selectedAisleType === 'forklift') {
                          setAisleWidthM(forkliftLaneWidthM);
                        }
                      }}
                      style={{ cursor: 'pointer', accentColor: '#d97706', width: 15, height: 15 }}
                    />
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: hasForklift ? '#92400e' : '#475569',
                      }}
                    >
                      Operasikan Forklift di Gudang
                    </span>
                  </div>
                  <span style={{ fontSize: '1rem' }}>🚜</span>
                </label>

                {/* Input Minimal Lebar Forklift (Secara sistem minimal 2.5m) */}
                {hasForklift && (
                  <div
                    style={{
                      paddingTop: '6px',
                      borderTop: '1px dashed #fde68a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#92400e' }}>
                          Minimal Lebar Forklift:
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#b45309' }}>
                          Standar sistem minimal 2.5m
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          value={forkliftLaneWidthM}
                          step="0.1"
                          min="2.5"
                          max="15"
                          onChange={(e) => {
                            const raw = e.target.value;
                            setForkliftLaneWidthM(raw);
                            const num = parseFloat(raw);
                            if (!isNaN(num) && num >= 2.5) {
                              if (selectedAisleType === 'forklift') {
                                setAisleWidthM(num);
                              }
                              notifyWalkwayChange({ forkliftLaneWidthM: num, forkliftWidthM: num });
                            }
                          }}
                          onBlur={() => {
                            const num = parseFloat(forkliftLaneWidthM);
                            const clamped = isNaN(num) || num < 2.5 ? 2.5 : Math.min(15, num);
                            setForkliftLaneWidthM(clamped);
                            if (selectedAisleType === 'forklift') {
                              setAisleWidthM(clamped);
                            }
                            notifyWalkwayChange({ forkliftLaneWidthM: clamped, forkliftWidthM: clamped });
                          }}
                          style={{
                            width: '56px',
                            padding: '3px 6px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            borderRadius: '6px',
                            border: Number(forkliftLaneWidthM) < 2.5 ? '1px solid #ef4444' : '1px solid #f59e0b',
                            background: '#ffffff',
                            color: '#92400e',
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>m</span>
                      </div>
                    </div>
                    {Number(forkliftLaneWidthM) < 2.5 && (
                      <div style={{ fontSize: '0.67rem', color: '#b91c1c', fontWeight: 600 }}>
                        ⚠️ Lebar jalur forklift minimal 2.5m untuk ruang manuver dan clearance aman armada.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pilihan & Kartu Seret Mode Jalan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  Pilih &amp; Tarik Jenis Jalan ke Kanvas:
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Klik untuk aktifkan / Seret ke denah</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {/* Tombol & Card: Jalan Standar */}
                <div
                  role="button"
                  tabIndex={0}
                  draggable={true}
                  onClick={() => handleSelectAisleType('standard')}
                  onDragStart={(e) => handleDragStart(e, 'aisle')}
                  style={{
                    padding: '8px 4px',
                    backgroundColor: selectedAisleType === 'standard' ? '#f0fdf4' : '#ffffff',
                    border: selectedAisleType === 'standard' ? '2px solid #16a34a' : '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    boxShadow: selectedAisleType === 'standard' ? '0 2px 8px rgba(22, 163, 74, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk memilih Jalan Standar, atau seret kartu ini ke kanvas denah"
                >
                  <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>🛣️</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedAisleType === 'standard' ? '#166534' : '#334155' }}>
                    Standar
                  </div>
                  <div style={{ fontSize: '0.68rem', color: selectedAisleType === 'standard' ? '#15803d' : '#64748b', marginTop: 2, fontWeight: 600 }}>
                    {localAisleWidthM}m
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: selectedAisleType === 'standard' ? '#dcfce7' : '#f1f5f9',
                        color: selectedAisleType === 'standard' ? '#15803d' : '#64748b',
                      }}
                    >
                      {selectedAisleType === 'standard' ? '✓ Aktif' : 'Pilih'}
                    </span>
                  </div>
                </div>

                {/* Tombol & Card: Jalan Forklift */}
                <div
                  role="button"
                  tabIndex={0}
                  draggable={true}
                  onClick={() => handleSelectAisleType('forklift')}
                  onDragStart={(e) => handleDragStart(e, 'forklift_aisle')}
                  style={{
                    padding: '8px 4px',
                    backgroundColor: selectedAisleType === 'forklift' ? '#fffbeb' : '#ffffff',
                    border: selectedAisleType === 'forklift' ? '2px solid #d97706' : '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    boxShadow: selectedAisleType === 'forklift' ? '0 2px 8px rgba(217, 119, 6, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Klik untuk memilih Jalan Forklift, atau seret kartu ini ke kanvas denah"
                >
                  <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>🚜</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedAisleType === 'forklift' ? '#b45309' : '#334155' }}>
                    Forklift
                  </div>
                  <div style={{ fontSize: '0.68rem', color: selectedAisleType === 'forklift' ? '#92400e' : '#64748b', marginTop: 2, fontWeight: 600 }}>
                    {forkliftLaneWidthM}m
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: selectedAisleType === 'forklift' ? '#fef3c7' : '#f1f5f9',
                        color: selectedAisleType === 'forklift' ? '#92400e' : '#64748b',
                      }}
                    >
                      {selectedAisleType === 'forklift' ? '✓ Aktif' : 'Pilih'}
                    </span>
                  </div>
                </div>

                {/* Tombol & Card: Jalur Penghubung / Celah */}
                <div
                  role="button"
                  tabIndex={0}
                  draggable={true}
                  onClick={() => handleSelectAisleType('pedestrian')}
                  onDragStart={(e) => handleDragStart(e, 'aisle', { name: 'Jalur Penghubung', width_mm: 1000 })}
                  style={{
                    padding: '8px 4px',
                    backgroundColor: selectedAisleType === 'pedestrian' ? '#eff6ff' : '#ffffff',
                    border: selectedAisleType === 'pedestrian' ? '2px solid #2563eb' : '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    boxShadow: selectedAisleType === 'pedestrian' ? '0 2px 8px rgba(37, 99, 235, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Jalur Penghubung Celah / Pejalan Kaki (1.0m, pas mengisi sela rak)"
                >
                  <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>🚶</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedAisleType === 'pedestrian' ? '#1d4ed8' : '#334155' }}>
                    Penghubung
                  </div>
                  <div style={{ fontSize: '0.68rem', color: selectedAisleType === 'pedestrian' ? '#2563eb' : '#64748b', marginTop: 2, fontWeight: 600 }}>
                    1.0m
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: selectedAisleType === 'pedestrian' ? '#dbeafe' : '#f1f5f9',
                        color: selectedAisleType === 'pedestrian' ? '#1d4ed8' : '#64748b',
                      }}
                    >
                      {selectedAisleType === 'pedestrian' ? '✓ Aktif' : 'Pilih'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateAisle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Kode Jalan / Lorong:
                <input
                  type="text"
                  value={aisleCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAisleCode(val);
                    if (isFillAisleMode && onToggleFillAisleMode) {
                      onToggleFillAisleMode(
                        {
                          type: selectedAisleType,
                          name: aisleName.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
                          code: val.trim() || (selectedAisleType === 'forklift' ? 'FK' : 'A'),
                          widthM: Number(aisleWidthM) || (selectedAisleType === 'forklift' ? forkliftLaneWidthM : localAisleWidthM),
                          direction: aisleDirection,
                        },
                        true
                      );
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  placeholder={`Contoh: ${selectedAisleType === 'forklift' ? 'FK' : 'A'}-${String(existingAisles.length + 1).padStart(2, '0')}`}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Nama Lintasan:
                <input
                  type="text"
                  value={aisleName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAisleName(val);
                    if (isFillAisleMode && onToggleFillAisleMode) {
                      onToggleFillAisleMode(
                        {
                          type: selectedAisleType,
                          name: val.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
                          code: aisleCode.trim() || (selectedAisleType === 'forklift' ? 'FK' : 'A'),
                          widthM: Number(aisleWidthM) || (selectedAisleType === 'forklift' ? forkliftLaneWidthM : localAisleWidthM),
                          direction: aisleDirection,
                        },
                        true
                      );
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  placeholder="Contoh: Jalur Utama Forklift"
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Lebar Jalan (Meter):
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min={selectedAisleType === 'forklift' ? '2.5' : '0.8'}
                    max="15"
                    step="0.1"
                    value={aisleWidthM}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAisleWidthM(val);
                      const num = parseFloat(val);
                      const minLimit = selectedAisleType === 'forklift' ? 2.5 : 0.8;
                      if (!isNaN(num) && num >= minLimit) {
                        if (selectedAisleType === 'standard') {
                          setLocalAisleWidthM(num);
                          notifyWalkwayChange({ aisleWidthM: num });
                        }
                        if (isFillAisleMode && onToggleFillAisleMode) {
                          onToggleFillAisleMode(
                            {
                              type: selectedAisleType,
                              name: aisleName.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
                              code: aisleCode.trim() || (selectedAisleType === 'forklift' ? 'FK' : 'A'),
                              widthM: num,
                              direction: aisleDirection,
                            },
                            true
                          );
                        }
                      }
                    }}
                    onBlur={() => {
                      const num = parseFloat(aisleWidthM);
                      const minLimit = selectedAisleType === 'forklift' ? 2.5 : 0.8;
                      const clamped = isNaN(num) || num < minLimit ? minLimit : Math.min(15, num);
                      setAisleWidthM(clamped);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: Number(aisleWidthM) < (selectedAisleType === 'forklift' ? 2.5 : 0.8) ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>meter</span>
                </div>
                {Number(aisleWidthM) < (selectedAisleType === 'forklift' ? 2.5 : 0.8) && (
                  <div style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ Lebar minimal {selectedAisleType === 'forklift' ? 'jalur forklift adalah 2.5m' : 'jalur manusia adalah 0.8m (80 cm)'}.
                  </div>
                )}
                {/* Preset Cepat Lebar Jalan */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {[0.8, 1.0, 1.2, 1.5, 2.0, 2.5].map((preset) => (
                    <button
                      key={`preset-${preset}`}
                      type="button"
                      onClick={() => {
                        setAisleWidthM(preset);
                        if (selectedAisleType === 'standard' && preset >= 1.5) {
                          setLocalAisleWidthM(preset);
                          notifyWalkwayChange({ aisleWidthM: preset });
                        }
                        if (isFillAisleMode && onToggleFillAisleMode) {
                          onToggleFillAisleMode(
                            {
                              type: selectedAisleType,
                              name: aisleName.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : selectedAisleType === 'pedestrian' ? 'Jalur Penghubung' : 'Jalan Lorong'),
                              code: aisleCode.trim() || (selectedAisleType === 'forklift' ? 'FK' : selectedAisleType === 'pedestrian' ? 'P' : 'A'),
                              widthM: preset,
                              direction: aisleDirection,
                            },
                            true
                          );
                        }
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        borderRadius: 4,
                        border: Number(aisleWidthM) === preset ? '1px solid #5c732b' : '1px solid #cbd5e1',
                        backgroundColor: Number(aisleWidthM) === preset ? '#f0fdf4' : '#ffffff',
                        color: Number(aisleWidthM) === preset ? '#15803d' : '#475569',
                        fontWeight: Number(aisleWidthM) === preset ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                  💡 Gunakan preset <strong>0.8m / 1.0m</strong> untuk mengisi celah sempit rak &amp; akses barcode.
                </span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Arah Arus Lalu Lintas:
                <select
                  value={aisleDirection}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAisleDirection(val);
                    if (isFillAisleMode && onToggleFillAisleMode) {
                      onToggleFillAisleMode(
                        {
                          type: selectedAisleType,
                          name: aisleName.trim() || (selectedAisleType === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
                          code: aisleCode.trim() || (selectedAisleType === 'forklift' ? 'FK' : 'A'),
                          widthM: Number(aisleWidthM) || (selectedAisleType === 'forklift' ? forkliftLaneWidthM : localAisleWidthM),
                          direction: val,
                        },
                        true
                      );
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                >
                  <option value="two_way">Dua Arah (Bolak-balik)</option>
                  <option value="one_way">Satu Arah (Searah)</option>
                  <option value="forklift">Khusus Sirkulasi Forklift</option>
                </select>
              </label>

              {/* Opsi Lebarkan Salah Satu Sisi Jalan */}
              {(() => {
                const curAisle = editingAssetId ? (existingAisles || []).find((a) => String(a.id) === String(editingAssetId)) : null;
                const isFk = curAisle
                  ? (curAisle.type === 'forklift' || String(curAisle.name || '').toLowerCase().includes('forklift') || curAisle.direction === 'forklift')
                  : (aisleDirection === 'forklift');
                const isHoriz = curAisle ? ((curAisle.width_mm || 2000) >= (curAisle.length_mm || 5000)) : true;
                const lockedWidthM = curAisle
                  ? ((isHoriz ? curAisle.length_mm : curAisle.width_mm) / 1000).toFixed(1)
                  : aisleWidthM;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Lebarkan Salah Satu Sisi Jalan:
                    </span>
                    {isFk && (
                      <div style={{ padding: '6px 10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.74rem', color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔒 Lebar jalur forklift ({lockedWidthM}m) dikunci sesuai input (hanya panjang lorong yang dapat diubah)</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button
                          type="button"
                          disabled={isFk && !isHoriz}
                          onClick={() => handleExpandSide('left', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && !isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && !isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && !isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && !isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && !isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && !isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah kiri (+0.5m)'}
                        >
                          ⬅️ Sisi Kiri (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && !isHoriz}
                          onClick={() => handleExpandSide('right', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && !isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && !isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && !isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && !isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && !isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && !isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah kanan (+0.5m)'}
                        >
                          ➡️ Sisi Kanan (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && isHoriz}
                          onClick={() => handleExpandSide('top', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah atas (+0.5m)'}
                        >
                          ⬆️ Sisi Atas (+0.5m)
                        </button>
                        <button
                          type="button"
                          disabled={isFk && isHoriz}
                          onClick={() => handleExpandSide('bottom', 0.5)}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: (isFk && isHoriz) ? '#f1f5f9' : '#fefce8',
                            border: `1px solid ${(isFk && isHoriz) ? '#cbd5e1' : '#fde047'}`,
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: (isFk && isHoriz) ? '#94a3b8' : '#854d0e',
                            cursor: (isFk && isHoriz) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: (isFk && isHoriz) ? 0.6 : 1,
                          }}
                          title={isFk && isHoriz ? 'Lebar penampang forklift terkunci' : 'Lebarkan jalan ke arah bawah (+0.5m)'}
                        >
                          ⬇️ Sisi Bawah (+0.5m)
                        </button>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                        💡 Tip: Anda juga dapat langsung menarik handle kotak di ujung jalan pada kanvas untuk memperpanjang/memperpendek lorong.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {editingAssetId ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    title="Simpan pembaruan ukuran & spesifikasi jalur jalan ini"
                  >
                    💾 Simpan Perubahan Jalan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssetId(null);
                      setEditingAssetType(null);
                    }}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Batal edit dan beralih ke mode tambah jalan baru"
                  >
                    + Jalan Baru
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  style={{
                    marginTop: 6,
                    padding: '10px 16px',
                    backgroundColor: selectedAisleType === 'forklift' ? '#d97706' : '#5c732b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: selectedAisleType === 'forklift'
                      ? '0 2px 6px rgba(217, 119, 6, 0.3)'
                      : '0 2px 6px rgba(92, 115, 43, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  + Tambah Jalur Jalan Baru
                </button>
              )}
            </form>
          </div>
        )}

        {/* Existing Assets Section */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              {showAllAssets
                ? `Semua Aset Terpasang (${existingAssets.length + existingAisles.length})`
                : activeTab === 'door'
                ? `Pintu Terpasang (${existingAssets.filter((a) => String(a.object_type || '').includes('door') || String(a.object_type || '').includes('entry') || String(a.object_type || '').includes('exit')).length})`
                : activeTab === 'dock'
                ? `Dok Muat Terpasang (${existingAssets.filter((a) => String(a.object_type || '').includes('dock')).length})`
                : `Jalan / Lorong Terpasang (${existingAisles.length})`}
            </span>
            <button
              type="button"
              onClick={() => setShowAllAssets((prev) => !prev)}
              style={{
                fontSize: '0.72rem',
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showAllAssets ? 'Filter Tab Ini' : `Semua (${existingAssets.length + existingAisles.length})`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {existingAssets
              .filter((asset) => {
                if (showAllAssets) return true;
                const isDoor =
                  String(asset.object_type || '').includes('door') ||
                  String(asset.object_type || '').includes('entry') ||
                  String(asset.object_type || '').includes('exit');
                const isDock = String(asset.object_type || '').includes('dock');
                if (activeTab === 'door') return isDoor;
                if (activeTab === 'dock') return isDock;
                return false;
              })
              .map((asset) => {
                const isBoth = String(asset.object_type || '') === 'door_both' || String(asset.object_type || '') === 'door';
                const isEntry = String(asset.object_type || '').includes('entry');
                const isExit = String(asset.object_type || '').includes('exit');
                const isDock = String(asset.object_type || '').includes('dock');
                const isSelected = editingAssetId === asset.id;
                return (
                  <div
                    key={`asset-${asset.id}`}
                    onClick={() => handleSelectExistingAsset(asset)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#f0fdf4' : '#f8fafc',
                      border: isSelected ? '2px solid #5c732b' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem' }}>{isDock ? '🚛' : '🚪'}</span>
                      <div>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: isBoth ? '#1d4ed8' : isEntry ? '#16a34a' : isExit ? '#dc2626' : '#1e293b',
                          }}
                        >
                          {asset.name || 'Aset'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {isBoth
                            ? 'Pintu Akses Masuk & Keluar'
                            : isEntry
                            ? 'Pintu Masuk Inbound'
                            : isExit
                            ? 'Pintu Keluar Outbound'
                            : isDock
                            ? 'Area Docking Truk'
                            : 'Aset Fisik'}{' '}
                          • {isDock
                              ? `${Math.round(asset.width_mm / 1000)}m × ${Math.round(asset.length_mm / 1000)}m`
                              : `Lebar ${Math.max(Math.round(asset.width_mm / 1000), Math.round(asset.length_mm / 1000))}m × Tinggi ${(asset.height_mm ? asset.height_mm / 1000 : 2.5).toFixed(1)}m`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isSelected ? '#dcfce7' : '#f1f5f9',
                          color: isSelected ? '#15803d' : '#475569',
                        }}
                      >
                        {isSelected ? 'Dipilih' : 'Pilih'}
                      </span>
                      {onDeleteAsset && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAsset('layout_object', asset.id);
                            if (editingAssetId === asset.id) {
                              setEditingAssetId(null);
                              setEditingAssetType(null);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '4px',
                          }}
                          title="Hapus Aset"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {(showAllAssets || activeTab === 'aisle') &&
              existingAisles.map((aisle) => {
                const isSelected = editingAssetId === aisle.id;
                return (
                  <div
                    key={`aisle-${aisle.id}`}
                    onClick={() => handleSelectExistingAsset(aisle)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#f0fdf4' : '#fefce8',
                      border: isSelected ? '2px solid #5c732b' : '1px solid #fef08a',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem' }}>🛣️</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{aisle.aisle_code} • {aisle.name}</span>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              backgroundColor: ((aisle.width_mm || 0) >= (aisle.length_mm || 0)) ? '#fef3c7' : '#ede9fe',
                              color: ((aisle.width_mm || 0) >= (aisle.length_mm || 0)) ? '#78350f' : '#5b21b6',
                              border: ((aisle.width_mm || 0) >= (aisle.length_mm || 0)) ? '1px solid #fde68a' : '1px solid #ddd6fe',
                            }}
                          >
                            {((aisle.width_mm || 0) >= (aisle.length_mm || 0)) ? 'H' : 'V'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#a16207' }}>
                          Lebar {Math.round(aisle.width_mm / 1000)}m × Panjang {Math.round(aisle.length_mm / 1000)}m
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isSelected ? '#dcfce7' : '#fef08a',
                          color: isSelected ? '#15803d' : '#854d0e',
                        }}
                      >
                        {isSelected ? 'Dipilih' : 'Pilih'}
                      </span>
                      {onDeleteAsset && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAsset('aisle', aisle.id);
                            if (editingAssetId === aisle.id) {
                              setEditingAssetId(null);
                              setEditingAssetType(null);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '4px',
                          }}
                          title="Hapus Jalan"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {((!showAllAssets &&
              activeTab === 'door' &&
              existingAssets.filter((a) =>
                String(a.object_type || '').includes('door') ||
                String(a.object_type || '').includes('entry') ||
                String(a.object_type || '').includes('exit')
              ).length === 0) ||
              (!showAllAssets &&
                activeTab === 'dock' &&
                existingAssets.filter((a) => String(a.object_type || '').includes('dock')).length === 0) ||
              (!showAllAssets && activeTab === 'aisle' && existingAisles.length === 0) ||
              (showAllAssets && existingAssets.length === 0 && existingAisles.length === 0)) && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                Belum ada {activeTab === 'aisle' ? 'jalan/lorong' : 'aset'} pada kategori ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Footer Actions (Muncul di Tiap Tab) */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafbfc',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          style={{
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Tutup
        </button>

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={!editingAssetId && !isDirty}
          style={{
            padding: '8px 20px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: (!editingAssetId && !isDirty) ? '#94a3b8' : '#5c732b',
            color: '#ffffff',
            cursor: (!editingAssetId && !isDirty) ? 'not-allowed' : 'pointer',
            boxShadow: (!editingAssetId && !isDirty) ? 'none' : '0 2px 6px rgba(92, 115, 43, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title={editingAssetId ? 'Simpan perubahan properti aset yang diedit' : isDirty ? 'Simpan seluruh perubahan layout ke database' : 'Pilih salah satu aset untuk mengedit atau simpan layout'}
        >
          {isSaving ? 'Menyimpan...' : '💾 Simpan'}
        </button>
      </div>
    </div>
  );
}
