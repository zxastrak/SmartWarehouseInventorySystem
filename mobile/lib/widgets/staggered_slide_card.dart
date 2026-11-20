import 'package:flutter/material.dart';

/// Wrapper animasi transisi staggered slide-up per card / elemen.
/// Elemen meluncur lembut dari bawah ke atas (+ fade) dengan delay proporsional terhadap [index].
class StaggeredSlideCard extends StatefulWidget {
  final Widget child;
  final int index;
  final Duration baseDelay;
  final Duration duration;
  final double offsetDistance;

  const StaggeredSlideCard({
    super.key,
    required this.child,
    this.index = 0,
    this.baseDelay = const Duration(milliseconds: 15),
    this.duration = const Duration(milliseconds: 180),
    this.offsetDistance = 10.0,
  });

  @override
  State<StaggeredSlideCard> createState() => _StaggeredSlideCardState();
}

class _StaggeredSlideCardState extends State<StaggeredSlideCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _slideAnim;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _slideAnim = Tween<double>(begin: widget.offsetDistance, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic),
    );
    _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutQuad),
    );

    final delay = widget.baseDelay * widget.index;
    if (delay == Duration.zero) {
      _ctrl.forward();
    } else {
      Future.delayed(delay, () {
        if (mounted) _ctrl.forward();
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, _slideAnim.value),
          child: Opacity(
            opacity: _fadeAnim.value.clamp(0.0, 1.0),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
