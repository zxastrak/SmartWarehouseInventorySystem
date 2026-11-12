$ErrorActionPreference = "Stop"

$xampp = "C:\xampp\mysql"
if (!(Test-Path $xampp)) {
    Write-Host "ERROR: Folder $xampp tidak ditemukan!"
    exit 1
}

Write-Host "Menghentikan proses mysqld jika ada..."
Stop-Process -Name mysqld -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 1. Backup full folder data lama
$backupDir = "$xampp\data_backup_susuno"
if (!(Test-Path $backupDir)) {
    Write-Host "Membuat backup full folder data ke $backupDir..."
    Copy-Item -Path "$xampp\data" -Destination $backupDir -Recurse -Force
    Write-Host "Backup berhasil dibuat."
} else {
    Write-Host "Backup sudah ada di $backupDir (aman)."
}

# 2. Buat data_new dari backup template bawaan XAMPP
$newDir = "$xampp\data_new"
if (Test-Path $newDir) {
    Remove-Item -Path $newDir -Recurse -Force
}
New-Item -ItemType Directory -Path $newDir -Force | Out-Null

Write-Host "Menyalin file template sistem bersih dari backup..."
Copy-Item -Path "$xampp\backup\*" -Destination $newDir -Recurse -Force

# 3. Salin folder database milik user (kecuali sistem internal)
$systemDirs = @('mysql', 'performance_schema', 'phpmyadmin', 'test')
Get-ChildItem -Path "$xampp\data" -Directory | Where-Object { $systemDirs -notcontains $_.Name.ToLower() } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$newDir\$($_.Name)" -Recurse -Force
    Write-Host "Menyalin database: $($_.Name)"
}

# 4. Salin ibdata1 dan ib_logfile* dari data lama agar LSN redo log tetap konsisten
if (Test-Path "$xampp\data\ibdata1") {
    Copy-Item -Path "$xampp\data\ibdata1" -Destination "$newDir\ibdata1" -Force
    Write-Host "Menyalin ibdata1..."
}
Get-ChildItem -Path "$xampp\data" -Filter "ib_logfile*" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$newDir\$($_.Name)" -Force
    Write-Host "Menyalin redo log: $($_.Name)..."
}

# 5. Tukar folder data
$crashedDirName = "data_crashed_" + (Get-Date -Format "yyyyMMdd_HHmmss")
Write-Host "Mengganti folder data lama menjadi $crashedDirName..."
Rename-Item -Path "$xampp\data" -NewName $crashedDirName
Rename-Item -Path $newDir -NewName "data"

Write-Host "SUKSES: Perbaikan struktur MySQL XAMPP selesai!"
