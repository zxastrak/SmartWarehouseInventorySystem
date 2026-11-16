import React, { useState, useEffect } from 'react';
import RecoveryLayout from '../components/RecoveryLayout.jsx';
import { authApi } from '../utils/api.js';

export default function ForgotPassword({ initialEmail = '', onBack }) {
  // steps: 'email' | 'otp' | 'password' | 'success'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Langkah 1: Kirim OTP ke Email
  async function handleSendOtp(event) {
    if (event) event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await authApi.sendOtp(trimmed);
      if (res.success) {
        setInfo(res.message || `Kode OTP telah dikirim ke ${trimmed}`);
        if (res.devOtp) setDevOtp(res.devOtp);
        setCountdown(60);
        setStep('otp');
      } else {
        setError(res.message || 'Gagal mengirim kode OTP.');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan pada server.');
    } finally {
      setLoading(false);
    }
  }

  // Langkah 2: Verifikasi OTP
  async function handleVerifyOtp(event) {
    event.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Masukkan 6 digit angka kode OTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authApi.verifyOtp(email.trim(), cleanOtp);
      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        setError('');
        setStep('password');
      } else {
        setError(res.message || 'Kode OTP salah atau sudah kedaluwarsa.');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat verifikasi OTP.');
    } finally {
      setLoading(false);
    }
  }

  // Langkah 3: Simpan Password Baru
  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authApi.resetPassword({
        email: email.trim(),
        new_password: newPassword,
        resetToken,
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.message || 'Gagal mereset password.');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan pada server.');
    } finally {
      setLoading(false);
    }
  }

  // Sukses
  if (step === 'success') {
    return (
      <RecoveryLayout
        eyebrow="RESET SELESAI"
        title="Password Berhasil Diperbarui"
        description="Password baru telah aktif dan tercatat pada sistem audit log SUSUNO."
      >
        <div className="recovery-form" style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <p style={{ color: '#2d3725', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Akun <strong>{email}</strong> sekarang dapat digunakan untuk masuk dengan password baru.
          </p>
          <button type="button" className="continue-button" onClick={() => onBack(email)}>
            Kembali ke Halaman Login
          </button>
        </div>
      </RecoveryLayout>
    );
  }

  // Layar 3: Password Baru
  if (step === 'password') {
    return (
      <RecoveryLayout
        eyebrow="LANGKAH 3 DARI 3"
        title="Buat Password Baru"
        description={`Sesi verifikasi OTP terkonfirmasi untuk ${email}.`}
      >
        <form className="recovery-form" noValidate onSubmit={handlePasswordSubmit}>
          {error && (
            <div className="recovery-error" role="alert" style={{ marginBottom: '1rem' }}>
              <strong>Gagal Reset Password</strong>
              <p>{error}</p>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="staff-new-password">Password Baru (Min. 8 Karakter)</label>
            <div className="password-input-wrap">
              <input
                id="staff-new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(''); }}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="staff-confirm-password">Konfirmasi Password Baru</label>
            <input
              id="staff-confirm-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              disabled={loading}
            />
          </div>

          <button type="submit" className="continue-button" disabled={loading}>
            {loading ? 'Memproses Reset...' : 'Simpan Password Baru'}
          </button>

          <aside className="recovery-info" style={{ marginTop: '1rem' }}>
            <h3>Keamanan Akun</h3>
            <p>Setiap perubahan kata sandi otomatis tercatat di <strong>Audit Log</strong> dashboard Manager demi keamanan gudang.</p>
          </aside>
        </form>
      </RecoveryLayout>
    );
  }

  // Layar 2: Input OTP
  if (step === 'otp') {
    return (
      <RecoveryLayout
        eyebrow="LANGKAH 2 DARI 3"
        title="Masukkan Kode OTP"
        description={`Kami telah mengirimkan 6 digit kode OTP ke ${email}.`}
      >
        <form className="recovery-form" noValidate onSubmit={handleVerifyOtp}>
          {info && !error && (
            <div style={{ padding: '0.75rem', background: '#f0f4ea', color: '#2d3725', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {info}
            </div>
          )}

          {devOtp && (
            <div style={{ padding: '0.65rem 0.85rem', background: '#eef6ec', border: '1px dashed #5c732b', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', color: '#2d3725' }}>
              🔑 <strong>Kode OTP Anda:</strong> <span style={{ fontWeight: 'bold', fontSize: '1.15rem', letterSpacing: '3px', color: '#3b5514', marginLeft: '6px' }}>{devOtp}</span>
            </div>
          )}

          {error && (
            <div className="recovery-error" role="alert" style={{ marginBottom: '1rem' }}>
              <p>{error}</p>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="input-otp">Kode OTP (6 Digit Angka)</label>
            <input
              id="input-otp"
              type="text"
              required
              maxLength={6}
              autoFocus
              placeholder="Contoh: 123456"
              style={{ fontSize: '1.4rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
              disabled={loading}
            />
          </div>

          <button type="submit" className="continue-button" disabled={loading || otp.length !== 6}>
            {loading ? 'Memverifikasi...' : 'Verifikasi Kode OTP →'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
            <button
              type="button"
              className="text-button"
              disabled={countdown > 0 || loading}
              onClick={handleSendOtp}
              style={{ color: countdown > 0 ? '#999' : '#5c732b' }}
            >
              {countdown > 0 ? `Kirim ulang OTP (${countdown}s)` : 'Kirim Ulang OTP'}
            </button>
            <button type="button" className="text-button" onClick={() => { setStep('email'); setError(''); }}>
              Ganti Email
            </button>
          </div>
        </form>
      </RecoveryLayout>
    );
  }

  // Layar 1: Input Email
  return (
    <RecoveryLayout
      eyebrow="RESET PASSWORD VIA EMAIL OTP"
      title="Lupa Password"
      description="Masukkan alamat email akun Anda. Kami akan mengirimkan 6 digit kode verifikasi OTP."
    >
      <form className="recovery-form forgot-form" noValidate onSubmit={handleSendOtp}>
        {error && (
          <div className="recovery-error" role="alert" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="recovery-email">Email Terdaftar</label>
          <input
            id="recovery-email"
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={event => { setEmail(event.target.value); setError(''); }}
            disabled={loading}
            aria-invalid={Boolean(error)}
          />
        </div>

        <button className="continue-button" type="submit" disabled={loading}>
          {loading ? 'Mengirim Kode OTP...' : 'Kirim Kode OTP ke Email →'}
        </button>

        <aside className="recovery-info">
          <h3>Verifikasi Aman</h3>
          <p>
            Kode OTP berlaku selama <strong>5 menit</strong> dan dikirimkan langsung ke inbox email Anda.
          </p>
        </aside>

        <button type="button" className="text-button recovery-back" onClick={() => onBack(email.trim())}>
          ← Kembali ke Halaman Login
        </button>
      </form>
    </RecoveryLayout>
  );
}
