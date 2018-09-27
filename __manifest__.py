
# -*- coding: utf-8 -*-

{
    'name': 'Point of Sale Guardar',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Poder guardar y cargar pedidos',
    'description': """ Poder guardar y cargar pedidos """,
    'author': 'Aquih',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_view.xml',
        'views/templates.xml',
    ],
    'qweb': [
        'static/src/xml/pos_guardar.xml',
    ],
    'installable': True,
    'website': 'http://aquih.com',
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
