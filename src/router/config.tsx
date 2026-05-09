import type { RouteObject } from "react-router-dom";
import Layout from "../components/feature/Layout";
import NotFound from "../pages/NotFound";
import Login from "../pages/login/page";
import Registro from "../pages/registro/page";
import Recuperar from "../pages/recuperar/page";
import ResetPassword from "../pages/reset-password/page";
import Home from "../pages/home/page";
import Facturacion from "../pages/facturacion/page";
import Clientes from "../pages/clientes/page";
import Rutas from "../pages/rutas/page";
import Productos from "../pages/productos/page";
import Incidencias from "../pages/incidencias/page";
import IncidVehiculo from "../pages/incidencias-vehiculo/page";
import Comunicacion from "../pages/comunicacion/page";
import Pedidos from "../pages/pedidos/page";
import HojaCalculo from "../pages/hoja-calculo/page";
import HojaPedidos from "../pages/hoja-pedidos/page";
import Email from "../pages/email/page";
import Empleados from "../pages/empleados/page";
import Empresa from "../pages/empresa/page";
import Estadisticas from "../pages/estadisticas/page";
import Calendario from "../pages/calendario/page";
import Documentos from "../pages/documentos/page";

import Legales from "../pages/legales/page";
import Notificaciones from "../pages/notificaciones/page";
import Sugerencias from "../pages/sugerencias/page";
import Combustible from "../pages/combustible/page";
import Perfil from "../pages/perfil/page";
import Configuracion from "../pages/configuracion/page";
import HojaRuta from "../pages/hoja-ruta/page";
import Asistente from "../pages/asistente/page";
import Cuadrante from "../pages/cuadrante/page";
import ControlHorario from "../pages/control-horario/page";
import MapaReparto from "../pages/mapa-reparto/page";
import Vehiculos from "../pages/vehiculos/page";
import UpgradePremium from "../pages/upgrade-premium/page";
import Albaranes from "../pages/albaranes/page";

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/registro",
    element: <Registro />,
  },
  {
    path: "/recuperar",
    element: <Recuperar />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/facturacion", element: <Facturacion /> },
      { path: "/albaranes", element: <Albaranes /> },
      { path: "/clientes", element: <Clientes /> },
      { path: "/rutas", element: <Rutas /> },
      { path: "/productos", element: <Productos /> },
      { path: "/incidencias", element: <Incidencias /> },
      { path: "/incid-vehiculo", element: <IncidVehiculo /> },
      { path: "/comunicacion", element: <Comunicacion /> },
      { path: "/pedidos", element: <Pedidos /> },
      { path: "/hoja-calculo", element: <HojaCalculo /> },
      { path: "/hoja-ruta", element: <HojaRuta /> },
      { path: "/hoja-pedidos", element: <HojaPedidos /> },
      { path: "/cuadrante", element: <Cuadrante /> },
      { path: "/email", element: <Email /> },
      { path: "/empleados", element: <Empleados /> },
      { path: "/empresa", element: <Empresa /> },
      { path: "/estadisticas", element: <Estadisticas /> },
      { path: "/calendario", element: <Calendario /> },
      { path: "/control-horario", element: <ControlHorario /> },
      { path: "/mapa-reparto", element: <MapaReparto /> },
      { path: "/vehiculos", element: <Vehiculos /> },
      { path: "/documentos", element: <Documentos /> },

      { path: "/legales", element: <Legales /> },
      { path: "/notificaciones", element: <Notificaciones /> },
      { path: "/sugerencias", element: <Sugerencias /> },
      { path: "/combustible", element: <Combustible /> },
      { path: "/perfil", element: <Perfil /> },
      { path: "/configuracion", element: <Configuracion /> },
      { path: "/asistente", element: <Asistente /> },
      { path: "/upgrade-premium", element: <UpgradePremium /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;