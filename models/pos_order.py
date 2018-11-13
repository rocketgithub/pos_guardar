# -*- encoding: utf-8 -*-

from openerp import models, fields, api, _
import logging

class PosOrder(models.Model):
    _inherit = 'pos.order'

    def buscar_pedidos(self,condiciones, campos):
        PosOrder = self.env['pos.order']
        orders = PosOrder.sudo().search_read(
            condiciones,
            campos)
        return orders

    def guardar_pedido_session_alterna(self,orden,orderline):
        orden_id = self.env['pos.order'].sudo().create(orden)
        for linea in orderline:
            linea['order_id'] = orden_id.id
            linea_id = self.env['pos.order.line'].sudo().create(linea)
        return orden_id.name

    def actualizar_pedido(self,orden_id,orden,orderline,restaurante):
        orders = self.env['pos.order'].search([['id', '=', orden_id]])
        logging.warn(restaurante)
        if restaurante:
            for order in orders:
                order.sudo().write({'partner_id': orden['partner_id'], 'user_id':orden['user_id'],'customer_count': orden['customer_count']})
        else:
            for order in orders:
                order.sudo().write({'partner_id': orden['partner_id'], 'user_id':orden['user_id']})
        lineas = self.env['pos.order.line'].search([['order_id', '=', orden_id]])
        lineas.sudo().unlink()
        for linea in orderline:
            linea['order_id'] = orden_id
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
        orden = self.env['pos.order'].search([['id','=',order_id]])
        orden.sudo().unlink()
        return True
