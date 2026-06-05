import { lazy } from 'react';
import type { RouteObject } from "react-router-dom";
import Layout from "../components/feature/Layout";
import NotFound from "../pages/NotFound";

// Auth pages — pequeñas, sin lazy (se necesitan antes de autenticar)
import Login from "../pages/login/page";
import Registro from "../pages/registro/page";
import Recuperar from "../pages/recuperar/page";
import ResetPassword from "../pages/reset-password/page";
import PromoPage from "../pages/promo/page";

// Páginas de la app — carga diferida por ruta (code splitting)
const Home           = lazy(() => import("../pages/home/page"));
const Facturacion    = lazy(() => import("../pages/facturacion/page"));
const Albaranes      = lazy(() => import("../pages/albaranes/page"));
const Clientes       = lazy(() => import("../pages/clientes/page"));
const Rutas          = lazy(() => import("../pages/rutas/page"));
const Productos      = lazy(() => import("../pages/productos/page"));
const Incidencias    = lazy(() => import("../pages/incidencias/page"));
const IncidVehiculo  = lazy(() => import("../pages/incidencias-vehiculo/page"));
const Comunicacion   = lazy(() => import("../pages/comunicacion/page"));
const Pedidos        = lazy(() => import("../pages/pedidos/page"));
const HojaCalculo    = lazy(() => import("../pages/hoja-calculo/page"));
const HojaRuta       = lazy(() => import("../pages/hoja-ruta/page"));
const HojaPedidos    = lazy(() => import("../pages/hoja-pedidos/page"));
const Cuadrante      = lazy(() => import("../pages/cuadrante/page"));
const Email          = lazy(() => import("../pages/email/page"));
const Empleados      = lazy(() => import("../pages/empleados/page"));
const Empresa        = lazy(() => import("../pages/empresa/page"));
const Estadisticas   = lazy(() => import("../pages/estadisticas/page"));
const Calendario     = lazy(() => import("../pages/calendario/page"));
const ControlHorario = lazy(() => import("../pages/control-horario/page"));
const MapaReparto    = lazy(() => import("../pages/mapa-reparto/page"));
const Vehiculos      = lazy(() => import("../pages/vehiculos/page"));
const Documentos     = lazy(() => import("../pages/documentos/page"));
const Legales        = lazy(() => import("../pages/legales/page"));
const Notificaciones = lazy(() => import("../pages/notificaciones/page"));
const Sugerencias    = lazy(() => import("../pages/sugerencias/page"));
const Combustible    = lazy(() => import("../pages/combustible/page"));
const Perfil         = lazy(() => import("../pages/perfil/page"));
const Configuracion  = lazy(() => import("../pages/configuracion/page"));
const Asistente      = lazy(() => import("../pages/asistente/page"));
const UpgradePremium = lazy(() => import("../pages/upgrade-premium/page"));
const TarjetaPromo   = lazy(() => import("../pages/tarjeta-promo/page"));

const routes: RouteObject[] = [
  { path: "/login",          element: <Login /> },
  { path: "/registro",       element: <Registro /> },
  { path: "/recuperar",      element: <Recuperar /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/promo",          element: <PromoPage /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/",                element: <Home /> },
      { path: "/facturacion",     element: <Facturacion /> },
      { path: "/albaranes",       element: <Albaranes /> },
      { path: "/clientes",        element: <Clientes /> },
      { path: "/rutas",           element: <Rutas /> },
      { path: "/productos",       element: <Productos /> },
      { path: "/incidencias",     element: <Incidencias /> },
      { path: "/incid-vehiculo",  element: <IncidVehiculo /> },
      { path: "/comunicacion",    element: <Comunicacion /> },
      { path: "/pedidos",         element: <Pedidos /> },
      { path: "/hoja-calculo",    element: <HojaCalculo /> },
      { path: "/hoja-ruta",       element: <HojaRuta /> },
      { path: "/hoja-pedidos",    element: <HojaPedidos /> },
      { path: "/cuadrante",       element: <Cuadrante /> },
      { path: "/email",           element: <Email /> },
      { path: "/empleados",       element: <Empleados /> },
      { path: "/empresa",         element: <Empresa /> },
      { path: "/estadisticas",    element: <Estadisticas /> },
      { path: "/calendario",      element: <Calendario /> },
      { path: "/control-horario", element: <ControlHorario /> },
      { path: "/mapa-reparto",    element: <MapaReparto /> },
      { path: "/vehiculos",       element: <Vehiculos /> },
      { path: "/documentos",      element: <Documentos /> },
      { path: "/legales",         element: <Legales /> },
      { path: "/notificaciones",  element: <Notificaciones /> },
      { path: "/sugerencias",     element: <Sugerencias /> },
      { path: "/combustible",     element: <Combustible /> },
      { path: "/perfil",          element: <Perfil /> },
      { path: "/configuracion",   element: <Configuracion /> },
      { path: "/asistente",       element: <Asistente /> },
      { path: "/upgrade-premium", element: <UpgradePremium /> },
      { path: "/tarjeta-promo",   element: <TarjetaPromo /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export default routes;
