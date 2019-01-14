# -*- encoding: utf-8 -*-

from openerp import models, fields, api, _

class PosConfig(models.Model):
    _inherit = 'pos.config'

    save_order_option = fields.Boolean(string="Opción para gurdar ventas")
    load_order_option = fields.Boolean(string="Opción para cargar ventas")
    load_order_session_option = fields.Boolean(string="Opción para cargar sesion")
    session_save_order = fields.Many2one('pos.session', string="Sesión para guardar pedidos")
    opcion_pedidos_vendedor = fields.Boolean(string="Solo cargar pedidos del vendedor")
    opcion_guardar_pedidos_mesas = fields.Boolean(string="Guardar pedidos al regresar a mesas")
