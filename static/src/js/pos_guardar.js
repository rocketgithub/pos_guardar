odoo.define('pos_guardar.pos_guardar', function (require) {
"use strict";

var screens = require('point_of_sale.screens');
var models = require('point_of_sale.models');
var pos_db = require('point_of_sale.DB');
var core = require('web.core');
var gui = require('point_of_sale.gui');
var Model = require('web.DataModel');
var _t = core._t;

var orden_id_cargada = 0;
var SaveOrderButton = screens.ActionButtonWidget.extend({
    template: 'SaveOrderButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
        var self = this;
        var order = this.pos.get_order();
        var restaurante = this.pos.config.floor_ids && this.pos.config.floor_ids.length > 0;
        if (order.get_order_id() == 0 || order.get_order_id() == null ){
            var orderlines = []
            for(var i = 0; i < order.orderlines.models.length; i++){
                orderlines.push({
                    'order_id':0,
                    'product_id': order.orderlines.models[i].product.id,
                    'qty': order.orderlines.models[i].quantity,
                    'discount': order.orderlines.models[i].discount,
                    'price_unit': order.orderlines.models[i].price
                    // 'tax_ids': tax
                })
            }
            var orden;
            if(restaurante > 0){
                orden = {
                    'partner_id': order.get_client().id,
                    'session_id': this.pos.config.session_save_order[0],
                    'user_id': this.pos.get_cashier().id,
                    'customer_count': order.get_customer_count(),
                    'table_id': order.table.id
                }
            }else{
                orden = {
                    'partner_id': order.get_client().id,
                    'session_id': this.pos.config.session_save_order[0],
                    'user_id': this.pos.get_cashier().id
                }
            }
            new Model("pos.order").call("guardar_pedido_session_alterna",[[],orden,orderlines]).then(function(order_name){

                self.gui.show_popup('confirm', {
                    'title': 'Pedido guardado No.',
                    'body': order_name,
                    'confirm': function(line) {
                    },
                });
            });
        }else{

            var orden;
            if (restaurante > 0){
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
            for(var i = 0; i < order.orderlines.models.length; i++){
                orderlines.push({
                    'order_id':0,
                    'product_id': order.orderlines.models[i].product.id,
                    'qty': order.orderlines.models[i].quantity,
                    'discount': order.orderlines.models[i].discount,
                    'price_unit': order.orderlines.models[i].price
                })
            }
            new Model("pos.order").call("actualizar_pedido",[[],order_id,orden,orderlines,restaurante]).then(function(result){

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


var LoadOrderButton = screens.ActionButtonWidget.extend({
    template: 'LoadOrderButton',
    init: function(parent, options) {
        this._super(parent, options);
        this.pos.bind('change:selectedOrder',this.renderElement,this);
    },
    button_click: function(){
        var self = this;
        this.gui.show_popup('textinput',{
            'title': _t('Ingrese referencia de orden'),
            'confirm': function(val) {
                var pedidos_usuario = this.pos.config.opcion_pedidos_vendedor;
                var restaurante = this.pos.config.floor_ids && this.pos.config.floor_ids.length > 0;
                var condiciones = [];
                var condiciones_por_nombre = [];
                var cashier = this.pos.get_cashier().id;
                if ( pedidos_usuario == true){
                    condiciones = [['state', '=', 'draft'], ['name', 'ilike', val],['user_id','=',this.pos.get_cashier().id]]
                    condiciones_por_nombre = [['state', '=', 'draft'], ['partner_id.name', 'ilike', val],['user_id','=',this.pos.get_cashier().id]]
                }else{
                    condiciones = [['state', '=', 'draft'], ['name', 'ilike', val]]
                    condiciones_por_nombre = [['state', '=', 'draft'], ['partner_id.name', 'ilike', val]]
                }
                var Orders = new Model('pos.order');
                if (restaurante > 0){
                    Orders.query(['name', 'state','partner_id','table_id'])
                         .filter(condiciones)
                         .limit(15)
                         .all().then(function (orders) {
                            if ( orders.length == 0){
                                Orders.query(['name', 'state','partner_id','table_id'])
                                     .filter(condiciones_por_nombre)
                                     .limit(15)
                                     .all().then(function (orders) {
                                        var orders_list = [];
                                        var i=0;
                                        for(i = 0; i < orders.length; i++){
                                            orders_list.push({'label': orders[i]['name'] +', Mesa: '+orders[i]['table_id'][1]+', Cliente: '+orders[i]['partner_id'][1] ,'item':orders[i]['id'],});
                                        }
                                        self.select_order(orders_list);
                                });
                            }else{
                                var orders_list = [];
                                var i=0;
                                for(i = 0; i < orders.length; i++){
                                    orders_list.push({'label': orders[i]['name'] +', Mesa: '+orders[i]['table_id'][1]+', Cliente: '+orders[i]['partner_id'][1] ,'item':orders[i]['id'],});
                                }
                                self.select_order(orders_list);
                            }
                    });
                }else{
                    Orders.query(['name', 'state','partner_id'])
                         .filter(condiciones)
                         .limit(15)
                         .all().then(function (orders) {
                            if (orders.length == 0){
                                Orders.query(['name', 'state','partner_id'])
                                     .filter(condiciones_por_nombre)
                                     .limit(15)
                                     .all().then(function (orders) {
                                        var orders_list = [];
                                        var i=0;
                                        for(i = 0; i < orders.length; i++){
                                            orders_list.push({'label': orders[i]['name'] +', Cliente: '+orders[i]['partner_id'][1],'item':orders[i]['id'],});
                                        }
                                        self.select_order(orders_list);
                                });
                            }else{
                                var orders_list = [];
                                var i=0;
                                for(i = 0; i < orders.length; i++){
                                    orders_list.push({'label': orders[i]['name'] +', Cliente: '+orders[i]['partner_id'][1],'item':orders[i]['id'],});
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
        var db = this.pos.db;
        var restaurante = this.pos.config.floor_ids && this.pos.config.floor_ids.length > 0;
        // var order = this.pos.get_order();
        this.gui.show_popup('selection', {
            'title': 'Por favor seleccione',
            'list': order,
            'confirm': function(line) {
                //line devuelve el id de la orden
                orden_id_cargada = line
                var OrdersLine = new Model('pos.order.line');
                var Order = new Model('pos.order');
                var Product = new Model('product.product');
                var cliente;
                var producto_id = 0;
                var precio_unitario=0;
                var cantidad=0;

                if (restaurante > 0){
                    Order.query(['id','user_id','partner_id','table_id','customer_count'])
                     .filter([['id', '=', line]])
                     .limit(15)
                     .all().then(function (partner) {
                        cliente = partner
                        orden_id_cargada = partner[0].id;
                        orden.set_customer_count(partner[0].customer_count);
                        self.pos.set_cashier({'id': partner[0].user_id[0]});
                        OrdersLine.query(['id', 'create_uid','name','order_id','price_unit','qty','product_id','discount'])
                         .filter([['order_id', 'like', line]])
                         .limit(15)
                         .all().then(function (orderslines) {
                            self.agregar_orden(partner, partner[0].id,orderslines);
                        });
                    });
                }else{
                    Order.query(['id','user_id','partner_id'])
                     .filter([['id', '=', line]])
                     .limit(15)
                     .all().then(function (partner) {
                        cliente = partner
                        orden_id_cargada = partner[0]['id'];

                        OrdersLine.query(['id', 'create_uid','name','order_id','price_unit','qty','product_id','discount'])
                         .filter([['order_id', 'like', line]])
                         .limit(15)
                         .all().then(function (orderslines) {
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
                                orden.add_product(producto,{price: precio,quantity: cantidad,cargar_extras: false});
                                orden.set_order_id(orden_id_cargada);
                            }
                            self.pos.set_cashier({'id': cliente[0].user_id[0]});
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
        var Restaurant = new Model('restaurant.table');
        var RestaurantFloor = new Model('restaurant.floor');
        var producto_id;
        var cantidad;
        self.pos.set_table(self.pos.tables_by_id[order[0].table_id[0]]);
        var orden = self.pos.get_order();
        orden.set_customer_count(order[0].customer_count);
        self.pos.set_cashier({'id': order[0].user_id[0]});
        orden.set_client(db.get_partner_by_id(order[0]['partner_id'][0]));
        self.pos.set_order(orden);
        for (var i=0; i< orderslines.length; i++){
            producto_id = orderslines[i]['product_id'][0];
            cantidad = orderslines[i]['qty'];
            var precio = orderslines[i]['price_unit'];
            var producto = db.get_product_by_id(producto_id);
            producto.extras_id = 0;
            orden.add_product(producto,{price:precio,quantity: cantidad,cargar_extras: false});
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
                var Session = new Model('pos.session');
                Session.query(['name', 'state'])
                 .filter([['state', '=', 'opened'], ['name', 'ilike', val]])
                 .limit(15)
                 .all().then(function (sessions) {
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
        var gui = this.pos.gui;
        var db = this.pos.db;
        var ordenes =[];
        var restaurante = this.pos.config.floor_ids && this.pos.config.floor_ids.length > 0;
        var i;
        var lineas_orden = [];
        gui.show_popup('selection',{
            'title': 'Por favor seleccione',
            'list': sessions_list,
            'confirm': function(session_id) {
                var cliente;
                var producto_id = 0;
                var precio_unitario=0;
                var cantidad=0;
                var Order = new Model('pos.order');
                if (restaurante > 0){
                    Order.query(['id','partner_id','user_id','table_id','customer_count'])
                     .filter([['session_id', '=', session_id],['state','=','draft']])
                     .limit(15)
                     .all().then(function (order) {
                        var precio_venta = [];
                        var cantidad_vendida = [];
                        var precio_unitario =0;
                        var cantidad =0;
                        var posicion_orden =0;
                        for (i=0; i < order.length; i++){
                            var a = i;
                            ordenes.push(order);
                            var Orderline = new Model('pos.order.line');
                            Orderline.query(['order_id','product_id','qty','discount','price_unit'])
                             .filter([['order_id', '=', order[i].id]])
                             .limit(15)
                             .all().then(function (orderslines) {
                                for (var a= 0; a < order.length; a++){
                                    if (order[a].id == orderslines[0].order_id[0]){
                                        self.agregar_orden(order,orderslines,a);
                                    }
                                }

                            });
                        }
                    });
                }else{
                    var Order = new Model('pos.order');
                    Order.query(['id','partner_id','user_id'])
                     .filter([['session_id', '=', session_id],['state','=','draft']])
                     .limit(15)
                     .all().then(function (order) {
                            var i;
                            for (i=0; i < order.length; i++){
                                ordenes.push(order);
                                var Orderlines = new Model('pos.order.line');
                                Orderlines.query(['order_id','product_id','qty','discount','price_unit'])
                                 .filter([['order_id', '=', order[i].id]])
                                 .limit(15)
                                 .all().then(function (orderslines) {
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
                                                orden.add_product(producto,{price:precio,quantity: cantidad,cargar_extras: false});
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
        var es_cargada = 1;
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
            var producto = db.get_product_by_id(producto_id)
            producto.qty = cantidad;
            producto.extras_id = 0;
            orden.add_product(producto,{price:precio,quantity: cantidad,cargar_extras: false});
        }
        new Model("pos.order").call("unlink_order",[[],order[a].id]).then(function(result){

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
        var invoiced = new $.Deferred();
        var orden = self.get_order();
        if(!order.get_client()){
            invoiced.reject({code:400, message:'Missing Customer', data:{}});
            return invoiced;
        }
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
            var orderModel = new Model('pos.order');
            orderModel.call('unlink', [orden.get_order_id()]).then(function (result) {
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
    },


});


models.Order = models.Order.extend({

    set_order_id: function(id) {
        this.set({
            order_id: id,
        });
    },

    get_order_id: function() {
        return this.get('order_id');
    },
});


});
