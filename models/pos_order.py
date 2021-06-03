# -*- encoding: utf-8 -*-

from openerp import models, fields, api, _
import logging

class PosOrder(models.Model):
    _inherit = 'pos.order'

    def buscar_pedidos(self,condiciones, campos):
        PosOrder = self.env['pos.order']
        orders = PosOrder.sudo().search_read(
            condiciones[0],
            campos[0])
        return orders

    def guardar_pedido_session_alterna(self,orden,orderline):
        orden_id = self.env['pos.order'].sudo().create(orden[0])
        for linea in orderline[0]:
            linea['order_id'] = orden_id.id
            linea_id = self.env['pos.order.line'].sudo().create(linea)
        return orden_id.name

#    def actualizar_referencia(self, orden_id, referencia):
#        orden = self.env['pos.order'].sudo().search([['id', '=', orden_id]])
#        orden.sudo().write({'pos_reference': referencia})

    def transferir_pedido(self, orden_id, mesa_id):
        orders = self.env['pos.order'].sudo().search([['id', '=', orden_id[0]]])
        if orders:
            for order in orders:
                order.sudo().write({'table_id': mesa_id[0]})
        return True

    def actualizar_pedido(self,orden_id,orden,orderline,restaurante):
        orders = self.env['pos.order'].sudo().search([['id', '=', orden_id[0]]])
        if restaurante[0]:
            for order in orders:
                if 'empleado_id' in orden[0]:
                    if 'pricelist_id' in orden[0]:
                        order.sudo().write({'partner_id': orden[0]['partner_id'], 'pricelist_id': orden[0]['pricelist_id'] ,'employee_id': orden[0]['empleado_id'],'user_id':orden[0]['user_id'],'customer_count': orden[0]['customer_count']})
                    else:
                        order.sudo().write({'partner_id': orden[0]['partner_id'], 'employee_id': orden[0]['empleado_id'],'user_id':orden[0]['user_id'],'customer_count': orden[0]['customer_count']})
                else:
                    if 'pricelist_id' in orden[0]:
                        order.sudo().write({'partner_id': orden[0]['partner_id'], 'pricelist_id': orden[0]['pricelist_id'] ,'employee_id': orden[0]['empleado_id'],'user_id':orden[0]['user_id'],'customer_count': orden[0]['customer_count']})
                    else:
                        order.sudo().write({'partner_id': orden[0]['partner_id'],'user_id':orden[0]['user_id'],'customer_count': orden[0]['customer_count']})

        else:
            for order in orders:
                order.sudo().write({'partner_id': orden[0]['partner_id'], 'user_id':orden[0]['user_id']})
        lineas = self.env['pos.order.line'].search([['order_id', '=', orden_id[0]]])
        lineas.sudo().unlink()
        for linea in orderline[0]:
            linea['order_id'] = orden_id[0]
            linea_id = self.env['pos.order.line'].sudo().create(linea)
        return True

    def guardar_pedido(self,ordenes,orderlines,sesion):
        ordenes_a_eliminar = []
        orden_id = 0
        for orden in ordenes:
            ordenes_a_eliminar.append(orden['id'])
            order = {
                'session_id': sesion[0],
                'partner_id': orden['partner_id'][0],
                'table_id': orden['table_id'][0],
                'customer_count': orden['customer_count']
            }
            orden_id = self.env['pos.order'].sudo().create(order)
            for linea in orderlines[0]:
                order_line = {
                    'order_id': orden_id.id,
                    'product_id': linea['product_id'][0],
                    'qty': linea['qty'],
                    'discount': linea['discount'],
                    'price_unit': linea['price_unit']
                }
                linea_id = self.env['pos.order.line'].sudo().create(order_line)
        ordenes = self.env['pos.order'].search([['id','in',ordenes_a_eliminar]])
        ordenes.sudo().unlink()
        return True

    def unlink_order(self,order_id):
        logging.getLogger('odoo order_id').warn(order_id)
        orden = self.env['pos.order'].sudo().search([['id','=',order_id]])
        logging.getLogger('odoo order').warn(orden)
        orden.sudo().unlink()
        return True

class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    note = fields.Char('Nota')

    def buscar_lineas_pedidos(self,condiciones, campos):
        PosOrder = self.env['pos.order.line']
        lines = PosOrder.sudo().search_read(
            condiciones[0],
            campos[0], order='order_id desc')
        return lines
