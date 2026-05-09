import { useState, useEffect, useRef } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useClickOutside } from '@/hooks/useClickOutside';
import { getGravatarUrl } from '@/lib/gravatar';
import AvatarCropEditor, { type CropData } from '@/components/feature/AvatarCropEditor';
import Modal from '@/components/base/Modal';
import ImageWithFallback from '@/components/base/ImageWithFallback';

export default function Perfil() {
  const { profile, saving, updateProfile, updateAvatar } = useProfile();

  const [form, setForm] = useState({
    name: 'Administrador',
    email: 'admin@quickly.com',
    phone: '+34 612 345 678',
    role: 'Administrador',
    department: 'Dirección',
    bio: '',
  });

  const [saved, setSaved] = useState(false);

  // Photo states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const photoModalRef = useRef<HTMLDivElement>(null);
  useClickOutside(photoModalRef, () => { setShowPhotoModal(false); setPhotoPreview(''); setPhotoFile(null); }, showPhotoModal);

  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Sync form from profile
  useEffect(() => {
    if (profile.id) {
      setForm({
        name: profile.full_name || 'Administrador',
        email: profile.email || 'admin@quickly.com',
        phone: profile.phone || '+34 612 345 678',
        role: profile.role || 'Administrador',
        department: profile.department || 'Dirección',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    const ok = await updateProfile({
      full_name: form.name,
      email: form.email,
      phone: form.phone,
      bio: form.bio,
    });

    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setPhotoPreview(result);
        setShowCropEditor(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfilePhoto = async () => {
    if (!photoPreview) return;
    setUploadingPhoto(true);
    setAvatarError(null);
    const result = await updateAvatar(photoPreview);
    setUploadingPhoto(false);
    if (result.success) {
      setShowPhotoModal(false);
      setPhotoPreview('');
      setPhotoFile(null);
    } else {
      setAvatarError(result.error || 'Error al guardar la foto. Inténtalo de nuevo.');
    }
  };

  const handleCropSave = async (croppedBase64: string, cropData: CropData) => {
    setShowCropEditor(false);
    setUploadingPhoto(true);
    setAvatarError(null);
    const result = await updateAvatar(croppedBase64, cropData);
    setUploadingPhoto(false);
    if (result.success) {
      setShowPhotoModal(false);
      setPhotoPreview('');
      setPhotoFile(null);
    } else {
      setAvatarError(result.error || 'Error al guardar la foto. Inténtalo de nuevo.');
    }
  };

  const handleCropCancel = () => {
    setShowCropEditor(false);
    setPhotoPreview('');
    setPhotoFile(null);
  };

  // Resolved avatar: custom upload > Gravatar fallback > icon
  const resolvedAvatar = profile.avatar_url || (profile.email ? getGravatarUrl(profile.email, 256, 'identicon') : null);
  const hasPhoto = !!resolvedAvatar;

  // Build initial crop data from profile if available
  const initialCrop: CropData | undefined = profile.avatar_crop_data && typeof profile.avatar_crop_data === 'object'
    ? {
        scale: (profile.avatar_crop_data as { scale?: number }).scale ?? 1,
        offsetX: (profile.avatar_crop_data as { offsetX?: number }).offsetX ?? 0,
        offsetY: (profile.avatar_crop_data as { offsetY?: number }).offsetY ?? 0,
      }
    : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Mi Perfil</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Gestiona tu información personal</p>
      </div>

      {/* Avatar + Info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {hasPhoto ? (
            <ImageWithFallback
              src={resolvedAvatar}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
              fallbackClassName="w-full h-full"
            />
          ) : (
            <i className="ri-user-line text-orange-600 text-3xl" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{form.name}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">{form.email}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{form.role} — {form.department}</p>
        </div>
        <button
          onClick={() => {
            setShowPhotoModal(true);
            setPhotoPreview(profile.avatar_url || '');
          }}
          className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 transition-all whitespace-nowrap"
        >
          Cambiar foto
        </button>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Información General</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
              }}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Se usa para sincronizar tu foto con Gravatar
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Teléfono</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Rol</label>
            <input
              type="text"
              value={form.role}
              disabled
              className="w-full px-3 py-2.5 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-slate-400 outline-none cursor-not-allowed"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Biografía</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Cuéntanos sobre ti..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none"
          />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <i className="ri-loader-4-line animate-spin" />
            ) : saved ? (
              <i className="ri-check-line" />
            ) : (
              <i className="ri-save-line" />
            )}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
          {saved && (
            <span className="text-sm text-green-600">¡Perfil actualizado!</span>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Seguridad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Contraseña actual</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Nueva contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
        </div>
        <button className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-all">
          Cambiar contraseña
        </button>
      </div>

      {/* Photo Upload Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={showCropEditor ? () => {} : () => { setShowPhotoModal(false); setPhotoPreview(''); setPhotoFile(null); }}
        title="Cambiar foto de perfil"
        size="md"
        hideCloseButton={showCropEditor}
      >
        {/* Gravatar info */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <i className="ri-global-line text-blue-400" />
            <span>
              Sin foto personalizada, se usa
              <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline ml-1">Gravatar</a>
              {' '}según tu email.
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-5">
          {photoPreview ? (
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-orange-200">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => { setPhotoPreview(''); setPhotoFile(null); }}
                className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full text-white flex items-center justify-center hover:bg-red-600 shadow-sm"
              >
                <i className="ri-close-line text-xs" />
              </button>
            </div>
          ) : hasPhoto ? (
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-orange-200">
              <ImageWithFallback
                src={resolvedAvatar}
                alt="Foto actual"
                className="w-full h-full object-cover"
                fallbackClassName="w-full h-full"
              />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-600">
              <i className="ri-user-line text-gray-300 dark:text-slate-600 text-4xl" />
            </div>
          )}
        </div>

        {/* Drag & drop area */}
        <label className="flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-800/50 cursor-pointer hover:border-orange-400 dark:hover:border-orange-400 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="w-10 h-10 flex items-center justify-center mb-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <i className="ri-upload-cloud-2-line text-xl text-orange-500" />
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">Arrastra tu imagen aquí</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">o haz clic para explorar</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">JPG, PNG, WEBP — max 5MB</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
        </label>

        {photoFile && (
          <p className="text-xs text-green-600 mt-2 text-center">
            <i className="ri-check-line mr-1" /> Archivo seleccionado: {photoFile.name}
          </p>
        )}

        {avatarError && (
          <p className="text-xs text-red-600 mt-2 text-center bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            <i className="ri-error-warning-line mr-1" /> {avatarError}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => { setShowPhotoModal(false); setPhotoPreview(''); setPhotoFile(null); }}
            className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={saveProfilePhoto}
            disabled={!photoPreview || uploadingPhoto}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            {uploadingPhoto ? (
              <><i className="ri-loader-4-line animate-spin" /> Subiendo...</>
            ) : (
              <><i className="ri-check-line" /> Guardar</>
            )}
          </button>
        </div>
      </Modal>

      {/* Crop Editor */}
      {showCropEditor && photoPreview && (
        <AvatarCropEditor
          imageSrc={photoPreview}
          initialCrop={initialCrop}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
