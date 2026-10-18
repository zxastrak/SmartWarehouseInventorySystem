import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../local/app_database.dart';
import '../remote/api_client.dart';

class ProductRepository {
  final AppDatabase _db;

  ProductRepository(this._db);

  Future<List<Product>> getProducts() async {
    try {
      final response = await ApiClient.get('/products');

      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        final List<Map<String, dynamic>> items =
            List<Map<String, dynamic>>.from(data);

        // Simpan ke SharedPreferences lokal
        await _db.saveProducts(items);
      }
    } catch (e) {
      debugPrint(
        'Mode Offline Chrome: Mengambil data dari SharedPreferences. Error: $e',
      );
    }

    return await _db.getAllProducts();
  }
}
