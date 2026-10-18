import 'package:flutter/foundation.dart';
import '../data/local/app_database.dart';
import '../data/repositories/product_repository.dart';

class ProductProvider with ChangeNotifier {
  final ProductRepository _repository;

  ProductProvider(this._repository);

  List<Product> _products = [];
  bool _isLoading = false;

  List<Product> get products => _products;
  bool get isLoading => _isLoading;

  // Fungsi untuk memuat data produk
  Future<void> fetchProducts() async {
    _isLoading = true;
    notifyListeners();

    try {
      _products = await _repository.getProducts();
    } catch (e) {
      debugPrint('Gagal memuat produk: $e');
    }

    _isLoading = false;
    notifyListeners();
  }
}
