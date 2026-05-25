---
title: Animations & Haptics
description: Animations- und Haptik-System der SLAM-App auf Basis der Design-Tokens.
---

**Last Updated:** 2026-04-29  
**Status:** Implemented

## Overview

SLAM uses a comprehensive animation and haptic feedback system to create a smooth, responsive, and engaging user experience. All animations follow the design tokens defined in `lib/app/design_tokens.dart`.

## Animation System

### Design Tokens

```dart
// Motion curves (§5.1)
static const Curve curveStandard = Cubic(0.32, 0.72, 0, 1);
static const Curve curveFeedback = Curves.easeOut;

// Motion durations (§5.2)
static const Duration dHover    = Duration(milliseconds: 200);
static const Duration dState    = Duration(milliseconds: 300);
static const Duration dScreen   = Duration(milliseconds: 500);
static const Duration dSwoosh   = Duration(milliseconds: 680);
static const Duration dConfetti = Duration(milliseconds: 1200);
```

### Key Animation Patterns

#### 1. Button Press Animation
**File:** `lib/shared/widgets/gradient_button.dart`

```dart
AnimatedScale(
  scale: _isPressed ? 0.94 : 1.0,
  duration: const Duration(milliseconds: 120),
  curve: Curves.easeOutCubic,
  child: // button content
)
```

- **Scale:** 0.94 when pressed (6% reduction)
- **Duration:** 120ms
- **Curve:** easeOutCubic for natural deceleration

#### 2. Navigation Tab Animation
**File:** `lib/features/home/presentation/widgets/main_navigation.dart`

```dart
AnimatedScale(
  scale: isActive ? 1.0 : 0.95,
  duration: SlamTokens.dState,
  curve: SlamTokens.curveStandard,
  child: Icon(...)
)
```

- Icons scale to 0.95 when inactive
- Smooth 300ms transition with custom curve

#### 3. Card Entrance Animation
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
_entranceCtrl = AnimationController(
  vsync: this, 
  duration: const Duration(milliseconds: 340)
);
_entranceFade = CurvedAnimation(
  parent: _entranceCtrl, 
  curve: Curves.easeOut
);
_entranceSlide = Tween<Offset>(
  begin: const Offset(0, 0.04), 
  end: Offset.zero
).animate(CurvedAnimation(
  parent: _entranceCtrl, 
  curve: Curves.easeOutCubic
));
```

- Fade + slide combination
- 340ms duration
- Subtle 4% vertical offset

#### 4. Shake Animation (Wrong Answer)
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
_shakeAnim = TweenSequence<double>([
  TweenSequenceItem(tween: Tween(begin: 0.0, end: 11.0), weight: 10),
  TweenSequenceItem(tween: Tween(begin: 11.0, end: -13.0), weight: 20),
  TweenSequenceItem(tween: Tween(begin: -13.0, end: 9.0), weight: 20),
  TweenSequenceItem(tween: Tween(begin: 9.0, end: -7.0), weight: 20),
  TweenSequenceItem(tween: Tween(begin: -7.0, end: 3.0), weight: 20),
  TweenSequenceItem(tween: Tween(begin: 3.0, end: 0.0), weight: 10),
]).animate(_shakeCtrl);
```

- 520ms total duration
- Decreasing amplitude oscillation
- Horizontal translation only

#### 5. Red Flash (Wrong Answer)
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
_redAnim = TweenSequence<double>([
  TweenSequenceItem(tween: Tween(begin: 0.0, end: 0.18), weight: 20),
  TweenSequenceItem(tween: Tween(begin: 0.18, end: 0.0), weight: 80),
]).animate(CurvedAnimation(
  parent: _redCtrl, 
  curve: Curves.easeInOut
));
```

- 650ms total duration
- Peak opacity: 0.18 (18%)
- Quick rise, slow fade

#### 6. Confetti Animation (Correct Answer)
**File:** `lib/shared/widgets/confetti_overlay.dart`

```dart
_ctrl = AnimationController(
  vsync: this,
  duration: const Duration(milliseconds: 1200),
);

// Particle physics
final px = (p.x + p.vx * t) * size.width;
final py = (p.y + p.vy * t + 0.5 * t * t) * size.height;
```

- 1200ms duration
- 40 particles with gravity simulation
- Dynamic theme colors (uses `SlamTokens.primary`)
- Rotation animation: `p.rotation + progress * π * 4`

## Haptic Feedback System

### Haptic Patterns

#### 1. Button Tap
**File:** `lib/shared/widgets/gradient_button.dart`

```dart
onTapDown: (_) {
  HapticFeedback.selectionClick();  // Light feedback on press
  setState(() => _isPressed = true);
},
onTap: () {
  HapticFeedback.mediumImpact();    // Medium feedback on release
  widget.onPressed?.call();
}
```

**Pattern:** Selection click → Medium impact

#### 2. Navigation Tab Switch
**File:** `lib/features/home/presentation/widgets/main_navigation.dart`

```dart
onTap: () {
  HapticFeedback.selectionClick();
  onTap();
}
```

**Pattern:** Single selection click

#### 3. Option Selection
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
void _selectOption(String optionId) {
  if (_answered) return;
  HapticFeedback.selectionClick();
  setState(() => _selectedOptionId = optionId);
}
```

**Pattern:** Selection click on tap

#### 4. Hint Reveal
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
void _revealHint() {
  HapticFeedback.mediumImpact();
  setState(() => _hintsShown++);
}
```

**Pattern:** Medium impact (more substantial than selection)

#### 5. Correct Answer (Multi-Pulse)
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
if (isCorrect && mounted) {
  HapticFeedback.heavyImpact();
  Future.delayed(const Duration(milliseconds: 50), () => 
    HapticFeedback.mediumImpact()
  );
  setState(() { _showSuccessBurst = true; _burstXp = xpEarned; });
}
```

**Pattern:** Heavy → (50ms) → Medium  
**Purpose:** Celebratory double-pulse

#### 6. Wrong Answer (Triple-Pulse)
**File:** `lib/features/live_feed/presentation/widgets/feed_question_card.dart`

```dart
else if (mounted) {
  HapticFeedback.heavyImpact();
  Future.delayed(const Duration(milliseconds: 100), () => 
    HapticFeedback.mediumImpact()
  );
  Future.delayed(const Duration(milliseconds: 200), () => 
    HapticFeedback.lightImpact()
  );
  _shakeCtrl.forward(from: 0);
  _redCtrl.forward(from: 0);
}
```

**Pattern:** Heavy → (100ms) → Medium → (100ms) → Light  
**Purpose:** Descending intensity pattern for negative feedback

### Haptic Feedback Types

| Type | Intensity | Use Case |
|------|-----------|----------|
| `selectionClick()` | Light | UI selections, taps, toggles |
| `lightImpact()` | Light | Subtle confirmations |
| `mediumImpact()` | Medium | Button presses, hint reveals |
| `heavyImpact()` | Heavy | Major events (correct/wrong answers) |

## Theme-Aware Animations

### Dynamic Color System

All animations use `SlamTokens.primary` instead of hardcoded colors, ensuring they adapt to the selected theme:

```dart
// ❌ OLD (hardcoded)
const Color(0xFFFF7A3B)

// ✅ NEW (theme-aware)
SlamTokens.primary
```

**Files Updated:**
- `lib/shared/widgets/confetti_overlay.dart`
- `lib/features/apps/presentation/screens/generative_apps_screen.dart`
- `lib/features/apps/presentation/screens/content_library_screen.dart`

### Theme Color Tokens

```dart
// Primary (runtime-mutable)
static Color primary     = const Color(0xFFFF7A3B);
static Color primaryOn   = const Color(0xFF23100A);
static Color primarySoft = const Color(0x24FF7A3B);

// Subject colors (fixed)
static const Color algebra       = Color(0xFFFFB35C);
static const Color analysis      = Color(0xFF7CC4FF);
static const Color geometrie     = Color(0xFFC88CFF);
static const Color stochastik    = Color(0xFF7FE3C4);
```

## Implementation Guidelines

### Adding New Animations

1. **Use design tokens** for duration and curves
2. **Keep animations subtle** (scale changes < 10%)
3. **Combine animations** for richer effects (fade + slide)
4. **Test on device** for performance

### Adding Haptic Feedback

1. **Match intensity to action importance**
2. **Use multi-pulse patterns** for major events
3. **Delay between pulses:** 50-100ms
4. **Test on physical device** (simulator doesn't have haptics)

### Performance Considerations

- Use `AnimatedContainer` for simple property changes
- Use `AnimationController` for complex sequences
- Dispose controllers in `dispose()`
- Use `TickerProviderStateMixin` for multiple controllers

## Known Issues & Fixes

### Issue: "Wo hängts?" Not Showing After All Hints
**Fixed:** 2026-04-29

Added 400ms delay before showing "Wo hängts?" button:

```dart
if (_hintsShown >= maxHints && !_answered) {
  Future.delayed(const Duration(milliseconds: 400), () {
    if (mounted && !_answered) {
      setState(() => _showWoHaengtsInput = true);
    }
  });
}
```

### Issue: Theme Colors Not Updating
**Fixed:** 2026-04-29

Replaced all hardcoded `Color(0xFFFF7A3B)` with `SlamTokens.primary` to ensure theme changes propagate throughout the app.

## Testing Checklist

- [ ] Button press animations feel responsive (< 150ms)
- [ ] Navigation transitions are smooth
- [ ] Confetti colors match selected theme
- [ ] Haptic feedback works on physical device
- [ ] Multi-pulse patterns have correct timing
- [ ] Animations don't cause jank (60fps maintained)
- [ ] Theme changes update all animated elements

## Related Files

- `lib/app/design_tokens.dart` - Animation constants
- `lib/shared/widgets/gradient_button.dart` - Button animations
- `lib/shared/widgets/confetti_overlay.dart` - Confetti system
- `lib/features/live_feed/presentation/widgets/feed_question_card.dart` - Question card animations
- `lib/features/home/presentation/widgets/main_navigation.dart` - Navigation animations
