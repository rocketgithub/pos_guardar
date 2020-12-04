odoo.define('pos_guardar.pos_guardar', function (require) {
"use strict";

var floors = require('pos_restaurant.floors');
var screens = require('point_of_sale.screens');
var models = require('point_of_sale.models');
var pos_db = require('point_of_sale.DB');
var rpc = require('web.rpc');
var gui = require('point_of_sale.gui');
var core = require('web.core');
var PopupWidget = require('point_of_sale.popups');
var chrome = require('point_of_sale.chrome');
var es_cargada = 0;
var QWeb = core.qweb;
var _t = core._t;
var orden_id_cargada = 0;

var LoadOrderButton = screens.ActionButtonWidget.extend({
    template: 'LoadOrderButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
        var self = this;
        var datos = []
        var gui = this.pos.gui;
        var restaurante = this.pos.config.module_pos_restaurant;
        var pedidos_usuario = this.pos.config.opcion_pedidos_vendedor;
        gui.show_popup('textinput',{
            'title': 'Ingrese referencia de orden',
            'confirm': function(val) {
                var condiciones = [];
                var condiciones_por_nombre = [];
                if ( pedidos_usuario == true){
                    condiciones = [['state', '=', 'draft'], ['name', 'ilike', val],['user_id','=',this.pos.get_cashier().id]]
                    condiciones_por_nombre = [['state', '=', 'draft'], ['partner_id.name', 'ilike', val],['user_id','=',this.pos.get_cashier().id]]
                }else{
                    condiciones = [['state', '=', 'draft'], ['name', 'ilike', val]]
                    condiciones_por_nombre = [['state', '=', 'draft'], ['partner_id.name', 'ilike', val]]
                }
                if (restaurante == true){
                    rpc.query({
                            model: 'pos.order',
                            method: 'buscar_pedidos',
                            args: [[],[condiciones],[['name', 'state','partner_id','table_id']]],
                        })
                        .then(function (orders){
                            if (orders.length == 0){
                                rpc.query({
                                        model: 'pos.order',
                                        method: 'buscar_pedidos',
                                        args: [[],[condiciones_por_nombre],[['name', 'state','partner_id','table_id']]],
                                    })
                                    .then(function (orders){
                                        var orders_list = [];
                                        var i=0;
                                        for(i = 0; i < orders.length; i++){
                                            orders_list.push({'label': orders[i]['name']+', Mesa: '+orders[i]['table_id'][1] + ', Cliente: '+orders[i]['partner_id'][1],'item':orders[i]['id'],});
                                        }
                                        self.select_order(orders_list);
                                    });
                            }else{
                                var mesa = self.pos.get_order().table.id
                                var orders_list = [];
                                var i=0;
                                var ordenes = [];
                                for(i = 0; i < orders.length; i++){
                                    if (orders[i].table_id[0] == mesa){
                                        ordenes.unshift(orders[i]);
                                    }else{
                                        ordenes.push(orders[i]);
                                    }

                                }
                                for(i = 0; i < ordenes.length; i++){
                                    orders_list.push({'label': ordenes[i]['name']+', Mesa: '+ordenes[i]['table_id'][1] + ', Cliente: '+ordenes[i]['partner_id'][1],'item':ordenes[i]['id'],});
                                }
                                self.select_order(orders_list);
                            }
                        });
                }else{
                    rpc.query({
                            model: 'pos.order',
                            method: 'buscar_pedidos',
                            args: [[],[condiciones],[['name', 'state','partner_id']]],
                        })
                        .then(function (orders){
                            if ( orders.length == 0){
                                rpc.query({
                                        model: 'pos.order',
                                        method: 'buscar_pedidos',
                                        args: [[],[condiciones_por_nombre],[['name', 'state','partner_id']]],
                                    })
                                    .then(function (orders){
                                        var orders_list = [];
                                        var i=0;
                                        for(i = 0; i < orders.length; i++){
                                            orders_list.push({'label': orders[i]['name'] + ', Cliente:'+orders[i]['partner_id'][1] ,'item':orders[i]['id'],});
                                        }
                                        self.select_order(orders_list);
                                    });
                            }else{
                                var orders_list = [];
                                var i=0;
                                for(i = 0; i < orders.length; i++){
                                    orders_list.push({'label': orders[i]['name'] + ', Cliente:'+orders[i]['partner_id'][1] ,'item':orders[i]['id'],});
                                }
                                self.select_order(orders_list);
                            }
                        });
                }
            },
        });
    },
    select_order: function(order){
        var self = this;
        var orden = this.pos.get_order();
        var gui = this.pos.gui;
        var db = this.pos.db;
        var restaurante = this.pos.config.module_pos_restaurant;
        var notas = this.pos.config.iface_orderline_notes;
        gui.show_popup('selection',{
            'title': 'Por favor seleccione',
            'list': order,
            'confirm': function(line) {
                var cliente;
                var producto_id = 0;
                var precio_unitario=0;
                var cantidad=0;
                if (restaurante == true){
                    rpc.query({
                            model: 'pos.order',
                            method: 'buscar_pedidos',
                            args: [[],[[['id', '=', line]]],[['id','partner_id','user_id','table_id','customer_count']]],
                        })
                        .then(function (partner){
                            cliente = partner
                            orden_id_cargada = partner[0].id;
                            orden.set_customer_count(partner[0].customer_count);
                            self.pos.set_cashier({'id': partner[0].user_id[0]});
                            if (notas || notas != null){
                                rpc.query({
                                        model: 'pos.order.line',
                                        method: 'search_read',
                                        args: [[['order_id', 'like', partner[0].id]], ['id', 'create_uid','name','order_id','price_unit','qty','product_id','discount','note']],
                                    })
                                    .then(function (orderslines){
                                        self.agregar_orden(partner, partner[0].id,orderslines);
                                    });
                            }else{
                                rpc.query({
                                        model: 'pos.order.line',
                                        method: 'search_read',
                                        args: [[['order_id', 'like', partner[0].id]], ['id', 'create_uid','name','order_id','price_unit','qty','product_id','discount']],
                                    })
                                    .then(function (orderslines){
                                        self.agregar_orden(partner, partner[0].id,orderslines);
                                    });
                            }
                        });
                }else{
                    rpc.query({
                            model: 'pos.order',
                            method: 'buscar_pedidos',
                            args: [[],[[['id', '=', line]]],[['id','partner_id','user_id']]],
                        })
                        .then(function (partner){
                            cliente = partner
                            orden_id_cargada = partner[0].id;
                            rpc.query({
                                model: 'pos.order.line',
                                method: 'search_read',
                                args: [[['order_id', 'like', partner[0].id]], ['id', 'create_uid','name','order_id','price_unit','qty','product_id','discount']],
                            })
                            .then(function (orderslines){
                                var lista=[]
                                var precio_venta = [];
                                var cantidad_vendida = [];
                                var val = 0;
                                var producto_id;
                                for (var i=0; i< orderslines.length; i++){
                                    lista.push({'product_id':orderslines[i]['product_id'][0],'qty':orderslines[i]['qty'],});
                                    producto_id = orderslines[i]['product_id'][0];
                                    var cantidad;
                                    var producto = db.get_product_by_id(orderslines[i]['product_id'][0])
                                    cantidad = orderslines[i]['qty'];
                                    var precio = orderslines[i]['price_unit'];
                                    orden.add_product(producto,{quantity: cantidad,cargar_extras: false});
                                    orden.set_order_id(orden_id_cargada);
                                }
                                self.pos.set_cashier({'id': partner[0].user_id[0]});
                                orden.set_client(db.get_partner_by_id(cliente[0]['partner_id'][0]));
                            });
                        });
                }
            },
        });

    },

    agregar_orden: function(order,order_id,orderslines){
        var self = this;
        var db = this.pos.db;
        var notas = this.pos.config.iface_orderline_notes;
        if (self.pos.tables_by_id &&
            order[0].table_id &&
            order[0].table_id[0] in self.pos.tables_by_id &&
            self.pos.tables_by_id[order[0].table_id[0]].floor) {
            self.pos.set_table(self.pos.tables_by_id[order[0].table_id[0]]);
        } else if (self.pos.floors &&
            self.pos.floors[0] &&
            self.pos.floors[0].tables &&
            self.pos.floors[0].tables[0]) {
            self.pos.set_table(self.pos.floors[0].tables[0]);
        }
        var orden = self.pos.get_order();
        orden.set_customer_count(order[0].customer_count);
        self.pos.set_cashier({'id': order[0].user_id[0]});
        orden.set_client(db.get_partner_by_id(order[0]['partner_id'][0]));
        self.pos.set_order(orden);
        for (var i=0; i< orderslines.length; i++){
            var producto_id = orderslines[i]['product_id'][0];
            var cantidad = orderslines[i]['qty'];
            var precio = orderslines[i]['price_unit'];
            var descuento = orderslines[i]['discount'];
            var producto = db.get_product_by_id(producto_id)
            orden.add_product(producto,{price: precio,quantity: cantidad,discount: descuento,cargar_extras: false});
            if (notas || notas != null){
                orden.get_selected_orderline().set_note(orderslines[i]['note']);
            }
            orden.set_order_id(orden_id_cargada);
        }
    }

});

screens.define_action_button({
    'name': 'load_order',
    'widget': LoadOrderButton,
    'condition': function(){
        return this.pos.config.load_order_option;
    },
});



function guardar_orden(obj, boton_guardar) {
    var gui = obj.pos.gui;
    var notas = obj.pos.config.iface_orderline_notes;
    var restaurante = obj.pos.config.module_pos_restaurant;

    var order = obj.pos.get_order();
//    order.printChanges();
    if (!(order.finalized)) {
        if (order.get_order_id() == 0 || order.get_order_id() == null ){
            var orderlines = []
            if (order.get_orderlines().length > 0){
                order.get_orderlines().forEach(function (orderline) {
                    if (notas){
                        orderlines.push({
                            'order_id':0,
                            'product_id': orderline.get_product().id,
                            'qty': orderline.get_quantity(),
                            'discount': orderline.get_discount(),
                            'price_unit': orderline.get_unit_price(),
                            'note': orderline.get_note()
                        })
                    }else{
                        orderlines.push({
                            'order_id':0,
                            'product_id': orderline.get_product().id,
                            'qty': orderline.get_quantity(),
                            'discount': orderline.get_discount(),
                            'price_unit': orderline.get_unit_price()
                        })
                    }

                });

                var orden;
                if(restaurante==true){
                    orden = {
                        'partner_id': order.get_client().id,
                        'session_id': obj.pos.config.session_save_order[0],
                        'user_id': obj.pos.get_cashier().id,
                        'customer_count': order.get_customer_count(),
                        'table_id': order.table.id,
    //                    'pos_reference': order.name,
                        'company_id': obj.pos.config.company_id[0]
                    }
                }else{
                    orden = {
                        'partner_id': order.get_client().id,
                        'session_id': obj.pos.config.session_save_order[0],
                        'user_id': obj.pos.get_cashier().id,
    //                    'pos_reference': order.name,
                        'company_id': obj.pos.config.company_id[0]
                    }
                }
                rpc.query({
                        model: 'pos.order',
                        method: 'guardar_pedido_session_alterna',
                        args: [[],[orden],[orderlines]],
                    })
                    .then(function (order_name){
                        if (boton_guardar) {
                            gui.show_popup('confirm',{
                                'title': 'Pedido guardado No.',
                                'body': order_name,
                                'confirm': function(data) {
                                },

                            });
                        }
                    });
            }
        }else{
            var orden;
            if (restaurante == true){
                orden = {
                    'partner_id': order.get_client().id,
                    'user_id': obj.pos.get_cashier().id,
//                    'pos_reference': order.name,
                    'customer_count': order.get_customer_count()
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
//                    'pos_reference': order.name,
                    'user_id': obj.pos.get_cashier().id
                }
            }

            var order_id = order.attributes.order_id;
            var order_id = order.attributes.order_id;
            var orderlines = []
            order.get_orderlines().forEach(function (orderline) {
                if (notas){
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price(),
                        'note': orderline.get_note()
                    })
                }else{
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price()
                    })
                }
            });

            rpc.query({
                    model: 'pos.order',
                    method: 'actualizar_pedido',
                    args: [[],[order_id],[orden],[orderlines],[restaurante]],
                })
                .then(function (result){

                });
        }
    }

    if (boton_guardar){
        obj.pos.delete_current_order();
    }
}


var SaveOrderButton = screens.ActionButtonWidget.extend({
    template: 'SaveOrderButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
        guardar_orden(this, true);
        var order = this.pos.get_order();
//        order.save_order = !order.save_order;
        this.renderElement();
    },
    button_click2: function(){
        var self = this;
        var gui = this.pos.gui;
        var restaurante = this.pos.config.module_pos_restaurant;
        var notas = this.pos.config.iface_orderline_notes;
        var order = this.pos.get_order();
        if (order.get_order_id() == 0 || order.get_order_id() == null ){
            var orderlines = []
            order.get_orderlines().forEach(function (orderline) {
                if (notas){
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price(),
                        'note': orderline.get_note()
                    })
                }else{
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price()
                    })
                }

            });

            var orden;
            if(restaurante==true){
                orden = {
                    'partner_id': order.get_client().id,
                    'session_id': this.pos.config.session_save_order[0],
                    'user_id': this.pos.get_cashier().id,
                    'customer_count': order.get_customer_count(),
                    'table_id': order.table.id,
//                    'pos_reference': order.name,
                    'company_id': this.pos.config.company_id[0]
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
                    'session_id': this.pos.config.session_save_order[0],
                    'user_id': this.pos.get_cashier().id,
//                    'pos_reference': order.name,
                    'company_id': this.pos.config.company_id[0]
                }
            }
            rpc.query({
                    model: 'pos.order',
                    method: 'guardar_pedido_session_alterna',
                    args: [[],[orden],[orderlines]],
                })
                .then(function (order_name){

                    gui.show_popup('confirm',{
                        'title': 'Pedido guardado No.',
                        'body': order_name,
                        'confirm': function(data) {
                        },

                    });


                });
        }else{
            var orden;
            if (restaurante == true){
                orden = {
                    'partner_id': order.get_client().id,
                    'user_id': this.pos.get_cashier().id,
//                    'pos_reference': order.name,
                    'customer_count': order.get_customer_count()
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
//                    'pos_reference': order.name,
                    'user_id': this.pos.get_cashier().id
                }
            }

            var order_id = order.attributes.order_id;
            var order_id = order.attributes.order_id;
            var orderlines = []
            order.get_orderlines().forEach(function (orderline) {
                if (notas){
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price(),
                        'note': orderline.get_note()
                    })
                }else{
                    orderlines.push({
                        'order_id':0,
                        'product_id': orderline.get_product().id,
                        'qty': orderline.get_quantity(),
                        'discount': orderline.get_discount(),
                        'price_unit': orderline.get_unit_price()
                    })
                }
            });

            rpc.query({
                    model: 'pos.order',
                    method: 'actualizar_pedido',
                    args: [[],[order_id],[orden],[orderlines],[restaurante]],
                })
                .then(function (result){

                });
        }
        this.pos.delete_current_order();
        order.save_order = !order.save_order;
        this.renderElement();
    },
});

screens.define_action_button({
    'name': 'save_order',
    'widget': SaveOrderButton,
    'condition': function(){
        return this.pos.config.save_order_option;
    },
});

var LoadOrderSessionButton = screens.ActionButtonWidget.extend({
    template: 'LoadOrderSessionButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
        var self = this;
        var order = this.pos.get_order();
        var gui = this.pos.gui;

        gui.show_popup('textinput',{
            'title': 'Ingrese sesión',
            'confirm': function(val) {
                rpc.query({
                        model: 'pos.session',
                        method: 'search_read',
                        args: [[['state', '=', 'opened'], ['name', 'ilike', val]], ['name', 'state']],
                    })
                    .then(function (sessions){
                        var sessions_list = [];
                        var i=0;
                        for(i = 0; i < sessions.length; i++){
                            sessions_list.push({'label': sessions[i]['name'],'item':sessions[i]['id'],});
                        }
                        self.select_session(sessions_list);
                    });
            },
        });
    },
    select_session: function(sessions_list){
        var self = this;
        // var orden = this.pos.get_order();
        var gui = this.pos.gui;
        var db = this.pos.db;
        var ordenes =[];
        var i;
        var lineas_orden = [];
        var restaurante = this.pos.config.module_pos_restaurant;
        gui.show_popup('selection',{
            'title': 'Por favor seleccione',
            'list': sessions_list,
            'confirm': function(session_id) {
                var cliente;
                var producto_id = 0;
                var precio_unitario=0;
                var cantidad=0;
                if (restaurante == true){
                    rpc.query({
                            model: 'pos.order',
                            method: 'search_read',
                            args: [[['session_id', '=', session_id],['state','=','draft']], ['id','partner_id','user_id','table_id','customer_count']],
                        })
                        .then(function (order){
                            var precio_venta = [];
                            var cantidad_vendida = [];
                            var precio_unitario =0;
                            var cantidad =0;
                            var posicion_orden =0;
                            for (i=0; i < order.length; i++){
                                var a = i;
                                ordenes.push(order);
                                rpc.query({
                                    model: 'pos.order.line',
                                    method: 'search_read',
                                    args: [[['order_id', '=', order[i].id]], ['order_id','product_id','qty','discount','price_unit']],
                                    })
                                .then(function (orderslines){
                                    for (var a= 0; a < order.length; a++){
                                        if (order[a].id == orderslines[0].order_id[0]){
                                            self.agregar_orden(order,orderslines,a);
                                        }
                                    }
                                });

                            }
                        });
                }else{
                    rpc.query({
                            model: 'pos.order',
                            method: 'search_read',
                            args: [[['session_id', '=', session_id],['state','=','draft']], ['id','partner_id','user_id']],
                        })
                        .then(function (order){
                            var i;
                            for (i=0; i < order.length; i++){
                                ordenes.push(order);
                                rpc.query({
                                    model: 'pos.order.line',
                                    method: 'search_read',
                                    args: [[['order_id', '=', order[i].id]], ['order_id','product_id','qty','discount','price_unit']],
                                    })
                                .then(function (orderslines){
                                    for(var a=0; a < order.length; a++){
                                        if (order[a].id == orderslines[0].order_id[0] ){
                                            self.pos.add_new_order();
                                            orden_id_cargada = order[a].id;
                                            var orden = self.pos.get_order();
                                            orden.set_order_id(orden_id_cargada);
                                            var producto_id;
                                            var cantidad;
                                            orden.set_client(db.get_partner_by_id(order[a]['partner_id'][0]));
                                            self.pos.set_cashier({'id': order[a].user_id[0]});
                                            for (var i=0; i< orderslines.length; i++){
                                                producto_id = orderslines[i]['product_id'][0];
                                                cantidad = orderslines[i]['qty'];
                                                var precio = orderslines[i]['price_unit'];
                                                var producto = db.get_product_by_id(producto_id)
                                                var descuento = orderslines[i]['discount'];
                                                orden.add_product(producto,{price: precio,quantity: cantidad,discount: descuento,cargar_extras: false});
                                                orden.set_order_id(orden_id_cargada);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                }
            },
        });

    },
    agregar_orden: function(order,orderslines,a){
        var self = this;
        var db = this.pos.db;
        es_cargada = 1;
        var producto_id;
        var cantidad;
        var orden_id_cargada = order[a].id
        self.pos.set_table(self.pos.tables_by_id[order[a].table_id[0]]);
        self.pos.add_new_order();
        var orden = self.pos.get_order();
        orden.set_customer_count(order[a].customer_count);
        self.pos.set_cashier({'id': order[a].user_id[0]});
        orden.set_client(db.get_partner_by_id(order[a]['partner_id'][0]));
        self.pos.set_order(orden);
        orden.set_order_id(orden_id_cargada);
        orden.orden_id_cargada = orden_id_cargada
        for (var i=0; i< orderslines.length; i++){
            producto_id = orderslines[i]['product_id'][0];
            cantidad = orderslines[i]['qty'];
            var precio = orderslines[i]['price_unit'];
            var descuento = orderslines[i]['discount'];
            var producto = db.get_product_by_id(producto_id)
            producto.qty = cantidad;
            orden.add_product(producto,{price: precio,quantity: cantidad,discount: descuento,cargar_extras: false});

        }
        rpc.query({
            model: 'pos.order',
            method: 'unlink_order',
            args: [[],[order[a].id]],
        })
        .then(function (result){

        });
    }

});

screens.define_action_button({
    'name': 'load_order_session',
    'widget': LoadOrderSessionButton,
    'condition': function(){
        return this.pos.config.load_order_session_option;
    },
});


var _super_posmodel = models.PosModel.prototype;
models.PosModel = models.PosModel.extend({
    transfer_order_to_different_table: function () {
        this.get_order().transferencia = true;
        this.order_to_transfer_to_different_table = this.get_order();
        this.set_table(null);
    },

    set_table: function(table) {
        var orden_transferir = this.get_order();
        if (!table) { // no table ? go back to the floor plan, see ScreenSelector
            this.set_order(null);

        } else if (this.order_to_transfer_to_different_table) {
            this.order_to_transfer_to_different_table.table = table;
            this.order_to_transfer_to_different_table.save_to_db();
            this.order_to_transfer_to_different_table = null;
            this.set_table(table);

            // cambiamos de mesa por medio de funcion transferir_pedido al hacer la transferencia
            var order_id = this.get_order().attributes.order_id;
            rpc.query({
                    model: 'pos.order',
                    method: 'transferir_pedido',
                    args: [[],[order_id],[table.id]],
                })
                .then(function (result){

                });

        } else {
            this.table = table;
            var orders = this.get_order_list();
            if (orders.length) {
                this.set_order(orders[0]); // and go to the first one ...
            }
            else {
                this.add_new_order();  // or create a new order with the current table
            }

        }
    },
})


// models.PosModel = models.PosModel.extend({
//     push_and_invoice_order: function(order){
//         var self = this;
//         var orden = this.get_order();
//         var invoiced = new $.Deferred();
//         if(!order.get_client()){
//             invoiced.reject({code:400, message:'Missing Customer', data:{}});
//             return invoiced;
//         }
//
//         var order_id = this.db.add_order(order.export_as_JSON());
//
//         this.flush_mutex.exec(function(){
//             var done = new $.Deferred(); // holds the mutex
//
//             // send the order to the server
//             // we have a 30 seconds timeout on this push.
//             // FIXME: if the server takes more than 30 seconds to accept the order,
//             // the client will believe it wasn't successfully sent, and very bad
//             // things will happen as a duplicate will be sent next time
//             // so we must make sure the server detects and ignores duplicated orders
//
//             var transfer = self._flush_orders([self.db.get_order(order_id)], {timeout:30000, to_invoice:true});
//
//             transfer.fail(function(error){
//                 invoiced.reject(error);
//                 done.reject();
//             });
//
//             // on success, get the order id generated by the server
//             transfer.pipe(function(order_server_id){
//
//                 // generate the pdf and download it
//                 self.chrome.do_action('point_of_sale.pos_invoice_report',{additional_context:{
//                     active_ids:order_server_id,
//                 }}).done(function () {
//                     invoiced.resolve();
//                     done.resolve();
//                 });
//             });
//
//             return done;
//
//         });
//
//         return invoiced;
//     }
//
// })


// Inicializamos el atributo transferencia, para saber si el pedido va a ser transferido al usar la opcion de cargar pedido al seleccionar mesas
var _super_order = models.Order.prototype;
models.Order = models.Order.extend({
    initialize: function() {
        _super_order.initialize.apply(this,arguments);
        this.transferencia = false;
        this.save_to_db();
    },

    set_order_id: function(id) {
        this.set({
            order_id: id,
        });
    },

    get_order_id: function() {
        return this.get('order_id');
    },

    set_orders_id: function(orders) {
        this.set({
            orders_id: orders,
        });
    },

    get_orders_id: function() {
        return this.get('orders_id');
    },
})



chrome.OrderSelectorWidget.include({
    floor_button_click_handler: function(){
        if (this.pos.config.opcion_guardar_pedidos_mesas){
            var orders = this.pos.get_order_list();
            for (var i = 0; i < orders.length; i++) {
                this.pos.set_order(orders[i]);
                guardar_orden(this, false);
            }
            // this.pos.get_customer_count(this.table);
            this.pos.set_table(null);
        }
    },

    floor_button_click_handler2: function(){
        var self = this;
//        var order = this.pos.get_order();
        var gui = this.pos.gui;
        var notas = this.pos.config.iface_orderline_notes;
        var restaurante = this.pos.config.module_pos_restaurant;
        if (this.pos.config.opcion_guardar_pedidos_mesas){

            var orders = this.pos.get_order_list();
            for (var i = 0; i < orders.length; i++) {
                this.pos.set_order(orders[i]);
                var order = this.pos.get_order();
                if (order.get_order_id() == 0 || order.get_order_id() == null ){
                    var orderlines = []
                    if (order.get_orderlines().length > 0){
                        order.get_orderlines().forEach(function (orderline) {
                            if (notas){
                                orderlines.push({
                                    'order_id':0,
                                    'product_id': orderline.get_product().id,
                                    'qty': orderline.get_quantity(),
                                    'discount': orderline.get_discount(),
                                    'price_unit': orderline.get_unit_price(),
                                    'note': orderline.get_note()
                                })
                            }else{
                                orderlines.push({
                                    'order_id':0,
                                    'product_id': orderline.get_product().id,
                                    'qty': orderline.get_quantity(),
                                    'discount': orderline.get_discount(),
                                    'price_unit': orderline.get_unit_price()
                                })
                            }

                        });
                        var orden;
                        orden = {
                            'partner_id': order.get_client().id,
                            'session_id': this.pos.config.session_save_order[0],
                            'user_id': this.pos.get_cashier().id,
                            'customer_count': order.get_customer_count(),
                            'table_id': order.table.id,
//                            'pos_reference': order.name,
                            'company_id': this.pos.config.company_id[0]
                        }
                        rpc.query({
                                model: 'pos.order',
                                method: 'guardar_pedido_session_alterna',
                                args: [[],[orden],[orderlines]],
                            })
                            .then(function (order_name){

                                gui.show_popup('confirm',{
                                    'title': 'Pedido guardado No.',
                                    'body': order_name,
                                    'confirm': function(data) {
                                    },

                                });


                            });
                    }
                    this.pos.delete_current_order();
                }else{
                    var orden;
                    orden = {
                        'partner_id': order.get_client().id,
                        'user_id': this.pos.get_cashier().id,
//                        'pos_reference': order.name,
                        'customer_count': order.get_customer_count()
                    }
                    var order_id = order.attributes.order_id;
                    var orderlines = []
                    order.get_orderlines().forEach(function (orderline) {
                        if (notas){
                            orderlines.push({
                                'order_id':0,
                                'product_id': orderline.get_product().id,
                                'qty': orderline.get_quantity(),
                                'discount': orderline.get_discount(),
                                'price_unit': orderline.get_unit_price(),
                                'note': orderline.get_note()
                            })
                        }else{
                            orderlines.push({
                                'order_id':0,
                                'product_id': orderline.get_product().id,
                                'qty': orderline.get_quantity(),
                                'discount': orderline.get_discount(),
                                'price_unit': orderline.get_unit_price()
                            })
                        }
                    });
                    rpc.query({
                            model: 'pos.order',
                            method: 'actualizar_pedido',
                            args: [[],[order_id],[orden],[orderlines],[restaurante]],
                        })
                        .then(function (result){

                        });
                    this.pos.delete_current_order();
                }
            }
        }
        this._super();
    },
});



floors.TableWidget.include({
    init: function(parent, options){
        var self = this;
        this._super(parent, options);
        this.cantidad_ordenes = 0;
        this.cantidad_clientes = 0;
    },
    obtener_cantidad: function(){
        var self = this;
        rpc.query({
                model: 'pos.order',
                method: 'search_read',
                args: [[['table_id', '=', self.table.id ],['state', '=', 'draft']], ['id','customer_count']],
            })
            .then(function (ordenes){
                var cantidad_clientes = 0;
                self.cantidad_ordenes = 0;
                self.cantidad_clientes = 0;
                if (ordenes.length > 0 ){
                    self.cantidad_ordenes = ordenes.length;
                    for (var i = 0; i < ordenes.length; i++){
                        cantidad_clientes += ordenes[i].customer_count
                    }
                    self.cantidad_clientes = cantidad_clientes;
                }
            })
            .always(function (){
                self.renderElement();
            });
    },
    renderElement: function(){
        var self = this;
        this._super();
        var intervalor = setInterval(function() {
            self.obtener_cantidad()
            clearInterval(intervalor);
        }, 33000);

    },
    click_handler: function(){
        this._super();
        var self = this;


        //Borra todas las pestañas de la pantalla del punto de venta.
        //Cuando hay muchas pestañas creadas (hacia la derecha), desaparecen el botón para eliminar pestañas.
        // Verificamos que no se elimine el pedido de la mesa origen, asi hacemos una transferencia sin alterar mas codigo,
        // en caso de eliminar el pedido, ya no hace la transferencia, utilizamos el atributo "transferencia"
        var orders = this.pos.get_table_orders(this.table);
        var orden_transferida = false;
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].transferencia == false){
                self.pos.set_order(orders[i]);
                self.pos.delete_current_order();
            }else{
                self.pos.delete_current_order();
            }

        }


        /*
        Guardo en pos_reference_ids los ids de las ordenes que ya están cargadas en la pantalla del punto de venta,
        para no cargarlas nuevamente.
        La idea de no cargarlas nuevamente es porque posiblemente esos pedidos cargados previamente pueden estar modificados en pantalla.
        */
        var pos_reference_ids = [];
        var order_id;
        var orders = this.pos.get_table_orders(this.table);
        var orden_a_transferir = false;
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].transferencia == false){
                alert(orders[i].name);
                pos_reference_ids.push(orders[i].name);
            }else{
                orden_a_transferir = true
            }


        }

        /*
        La primera vez que el usuario ingresa a la pantalla del punto de venta, ya existe una pestaña vacía.
        Reviso si esta pestaña existe para utilizarla posteriormente.
        */
        var existe_orden_en_blanco = false;
        if (orders.length == 1) {
            order_id = orders[0].get_order_id();
            if (order_id == 0 || order_id == null) {
                if (!orders[0].get_client()) {
                    if (orders[0].get_orderlines().length == 0) {
                        existe_orden_en_blanco = true;
                    }
                }
            }
        }

        // Obtengo pedidos de la mesa, en borrador, y que no esten ya cargados en la pantalla del punto de venta.
        rpc.query({
                model: 'pos.order',
                method: 'buscar_pedidos',
                args: [[],[[['table_id', '=', this.table.id], ['state', '=', 'draft'], ['pos_reference', 'not in', pos_reference_ids]]],[['id', 'partner_id', 'user_id', 'table_id', 'customer_count']]],
            })
            .then(function (orders){
                if (orders.length == 0) {
                    // Verificamos que si existe alguna orden a transferir a otra mesa,asi no cree un pedido en blanco al lado derecho
                    // nos apoya a que al hacer la tranferencia en la mesa destino, aparesca seleccionada por default el pedido trasladado
                    if (orden_a_transferir == false){
                        self.pos.add_new_order();
                    }

                }
                else if (orders.length > 0) {
                    var ordenes = {};
                    var order_ids = [];
                    for (i = 0; i < orders.length; i++) {
                        order_ids.push(orders[i].id);
                        ordenes[orders[i].id] = orders[i];
                    }

                    /*
                    En una sola consulta obtengo todas las lineas de todos los pedidos encontrados.
                    Esto para evitar posibles problemas asincronicos.
                    */
                    rpc.query({
                            model: 'pos.order.line',
                            method: 'buscar_lineas_pedidos',
                            args: [[],[[['order_id', 'in', order_ids]]],[['id', 'create_uid', 'order_id', 'price_unit', 'qty', 'product_id', 'discount', 'note']]],
                        })
                        .then(function (lines){
                            if (lines.length > 0) {
                                var db = self.pos.db;
                                var notas = self.pos.config.iface_orderline_notes;
                                var order_id = 0;

                                for (i = 0; i < lines.length; i++) {
                                    //Reviso si la linea corresponde a un siguiente pedido.
                                    if (order_id != lines[i].order_id[0]) {
                                        //Decido si se crea una nueva pestaña, o se utiliza la que ya está en blanco por default.
                                        if (i == 0) {
                                            if (!existe_orden_en_blanco) {
                                                self.pos.add_new_order();
                                            }
                                        }
                                        else {
                                            self.pos.add_new_order();
                                        }

                                        // Este bloque copy/paste del proceso de Cargar (LoadOrderButton).
                                        order_id = lines[i].order_id[0];
                                        var o = self.pos.get_order();
                                        o.set_customer_count(ordenes[order_id].customer_count);
                                        self.pos.set_cashier({'id': ordenes[order_id].user_id[0]});
                                        o.set_client(db.get_partner_by_id(ordenes[order_id]['partner_id'][0]));
                                        o.set_order_id(ordenes[order_id].id);
                                        self.pos.set_order(o);
                                        ordenes[order_id] = null;

/*
                                        rpc.query({
                                                model: 'pos.order',
                                                method: 'actualizar_referencia',
                                                args: [[], ordenes[order_id].id, o.name],
                                            })
                                            .then(function (result){});
*/

                                    }
                                    // Se agrega el producto al pedido actual, y posteriormente una nota (copy/paste).
                                    o.add_product(db.get_product_by_id(lines[i]['product_id'][0]), {price: lines[i]['price_unit'], quantity: lines[i]['qty'], discount: lines[i]['discount'], cargar_extras: false});
                                    if (notas || notas != null){
                                        o.get_last_orderline().set_note(lines[i]['note']);
                                    }
                                    o.saveChanges();
                                }
                            }
                            for (var order_id in ordenes) {
                                if (ordenes[order_id] != null) {
                                    var db = self.pos.db;
                                    self.pos.add_new_order();

                                    var o = self.pos.get_order();
                                    o.set_customer_count(ordenes[order_id].customer_count);
                                    self.pos.set_cashier({'id': ordenes[order_id].user_id[0]});
                                    o.set_client(db.get_partner_by_id(ordenes[order_id]['partner_id'][0]));
                                    o.set_order_id(ordenes[order_id].id);
                                    self.pos.set_order(o);
                                    ordenes[order_id] = null;
                                }
                            }

                        });
                }

            });

    },
});


screens.PaymentScreenWidget.include({
    finalize_validation: function(){
        console.log('finalize_validation');
        this._super();
        var order = this.pos.get_order();
        if (!(order.get_order_id() == 0 || order.get_order_id() == null )) {
            var order_id = order.get_order_id();
            console.log('js order_id: ' + order_id);
            rpc.query({
                model: 'pos.order',
                method: 'unlink_order',
                args: [[], order_id],
            })
            .then(function (result){
                console.log('unlink_order result: ' + result);
            });
        }
    }
});



});
