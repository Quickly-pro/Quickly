import { useState } from 'react';

const sections = [
  {
    id: 'terminos',
    label: 'Términos de Uso',
    icon: 'ri-file-text-line',
    title: 'Términos de Uso',
    content: [
      'Al utilizar Quickly, aceptas estos términos en su totalidad. El servicio está destinado exclusivamente a uso empresarial para la gestión de repartos, clientes y logística.',
      'Nos reservamos el derecho de modificar estos términos en cualquier momento con un aviso previo de 30 días. El uso continuado del servicio constituye la aceptación de los nuevos términos.',
      'El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.',
      'Queda prohibido el uso del servicio para actividades ilegales, spam, distribución de malware o cualquier actividad que perjudique a terceros.',
      'Quickly no se hace responsable de los daños indirectos, pérdida de beneficios o interrupciones del servicio causadas por factores externos a nuestro control.',
    ],
  },
  {
    id: 'privacidad',
    label: 'Política de Privacidad',
    icon: 'ri-eye-line',
    title: 'Política de Privacidad',
    content: [
      'Recopilamos únicamente los datos necesarios para el funcionamiento del servicio: información de empresa, clientes, pedidos y empleados que tú mismo introduces.',
      'Tus datos nunca se venden a terceros. Solo compartimos información con proveedores de infraestructura (servidores en la UE) bajo acuerdos de confidencialidad estrictos.',
      'Tienes derecho a acceder, rectificar, exportar y eliminar tus datos en cualquier momento desde la configuración de tu cuenta o contactándonos directamente.',
      'Conservamos los datos durante el período de suscripción activa y hasta 60 días después de la cancelación, momento en el que se eliminan permanentemente.',
    ],
  },
  {
    id: 'seguridad',
    label: 'Seguridad de los Datos',
    icon: 'ri-lock-2-line',
    title: 'Seguridad de los Datos',
    content: [
      'Todos los datos se transmiten cifrados mediante TLS 1.3 y se almacenan en servidores con cifrado AES-256 en centros de datos certificados ISO 27001 dentro de la Unión Europea.',
      'Realizamos copias de seguridad automáticas cada 24 horas con retención de 30 días. En caso de incidente, disponemos de un plan de recuperación con objetivo de tiempo de recuperación menor a 4 horas.',
      'El acceso a los datos de producción está restringido a personal autorizado con autenticación multifactor y auditoría de accesos.',
      'Notificaremos a los usuarios afectados en un plazo máximo de 72 horas en caso de brecha de seguridad, conforme al RGPD.',
    ],
  },
  {
    id: 'rgpd',
    label: 'Cumplimiento RGPD',
    icon: 'ri-shield-check-line',
    title: 'Cumplimiento RGPD',
    content: [
      'Quickly cumple con el Reglamento General de Protección de Datos (RGPD) de la Unión Europea. Somos el encargado del tratamiento de los datos que introduces en la plataforma.',
      'Puedes ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) enviando un email a privacidad@quickly.app con tu solicitud y una copia de tu documento de identidad.',
      'Para cualquier consulta sobre protección de datos, puedes contactar con nuestro Delegado de Protección de Datos (DPD) en dpo@quickly.app.',
      'Última actualización: Abril 2026.',
    ],
  },
];

export default function Legales() {
  const [activeSection, setActiveSection] = useState('terminos');

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-shield-star-line text-orange-600 text-xl" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Información Legal</h1>
          <p className="text-sm text-gray-500">Última actualización: Abril 2026</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all text-left
                ${activeSection === section.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={section.icon} />
              </div>
              <span className="font-medium">{section.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${currentSection.icon} text-orange-600`} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{currentSection.title}</h2>
          </div>

          <div className="space-y-4">
            {currentSection.content.map((paragraph, idx) => (
              <p key={idx} className="text-sm text-gray-600 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-400">
            <span>© 2026 Quickly</span>
            <span>·</span>
            <a href="mailto:privacidad@quickly.app" className="text-orange-500 hover:underline">privacidad@quickly.app</a>
            <span>·</span>
            <a href="mailto:soporte@quickly.app" className="text-orange-500 hover:underline">soporte@quickly.app</a>
          </div>
        </div>
      </div>
    </div>
  );
}