import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class Product {
  final int id;
  final String name;
  final String sku;
  final int quantity;
  final double price;

  Product({
    required this.id,
    required this.name,
    required this.sku,
    required this.quantity,
    required this.price,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'sku': sku,
    'quantity': quantity,
    'price': price,
  };

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      sku: json['sku'] ?? '',
      quantity: json['quantity'] ?? 0,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class AppDatabase {
  static const String _key = 'offline_products';

  Future<List<Product>> getAllProducts() async {
    final prefs = await SharedPreferences.getInstance();
    final String? data = prefs.getString(_key);
    if (data == null) return [];
    final List list = jsonDecode(data);
    return list.map((e) => Product.fromJson(e)).toList();
  }

  Future<void> saveProducts(List<Map<String, dynamic>> productsJson) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(productsJson));
  }
}
