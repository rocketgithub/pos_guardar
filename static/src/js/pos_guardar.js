odoo.define('pos_guardar.pos_guardar', function (require) {
"use strict";

var screens = require('point_of_sale.screens');
var models = require('point_of_sale.models');
var pos_db = require('point_of_sale.DB');
var rpc = require('web.rpc');
var gui = require('point_of_sale.gui');
var core = require('web.core');
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

var SaveOrderButton = screens.ActionButtonWidget.extend({
    template: 'SaveOrderButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
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
                    'company_id': this.pos.config.company_id[0]
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
                    'session_id': this.pos.config.session_save_order[0],
                    'user_id': this.pos.get_cashier().id,
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
                    'customer_count': order.get_customer_count()
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
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



models.PosModel = models.PosModel.extend({
    push_and_invoice_order: function(order){
        var self = this;
        var orden = this.get_order();
        var invoiced = new $.Deferred();
        if(!order.get_client()){
            invoiced.reject({code:400, message:'Missing Customer', data:{}});
            return invoiced;
        }

        rpc.query({
            model: 'pos.order',
            method: 'unlink_order',
            args: [[],[orden.get_order_id()]],
        })
        .then(function (result){

        });

        var order_id = this.db.add_order(order.export_as_JSON());

        this.flush_mutex.exec(function(){
            var done = new $.Deferred(); // holds the mutex

            // send the order to the server
            // we have a 30 seconds timeout on this push.
            // FIXME: if the server takes more than 30 seconds to accept the order,
            // the client will believe it wasn't successfully sent, and very bad
            // things will happen as a duplicate will be sent next time
            // so we must make sure the server detects and ignores duplicated orders

            var transfer = self._flush_orders([self.db.get_order(order_id)], {timeout:30000, to_invoice:true});

            transfer.fail(function(error){
                invoiced.reject(error);
                done.reject();
            });

            // on success, get the order id generated by the server
            transfer.pipe(function(order_server_id){

                // generate the pdf and download it
                self.chrome.do_action('point_of_sale.pos_invoice_report',{additional_context:{
                    active_ids:order_server_id,
                }}).done(function () {
                    invoiced.resolve();
                    done.resolve();
                });
            });

            return done;

        });

        return invoiced;
    }

})


var _super_order = models.Order.prototype;
models.Order = models.Order.extend({

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
        var self = this;
        var order = this.pos.get_order();
        var gui = this.pos.gui;
        var notas = this.pos.config.iface_orderline_notes;
        var restaurante = this.pos.config.module_pos_restaurant;
        if (this.pos.config.opcion_guardar_pedidos_mesas){
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
        this._super();
    },
});

});
