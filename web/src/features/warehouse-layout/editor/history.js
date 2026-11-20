/**
 * History Manager for Floor Plan Editor
 * Implements an inverted JSON-patch based undo/redo stack capped at 100 steps.
 * Provides deterministic state rollback without duplicating full snapshot memory.
 */

export class HistoryManager {
  /**
   * @param {number} [maxSteps=100] - Maximum history depth
   */
  constructor(maxSteps = 100) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.savedIndex = 0;
    this.currentIndex = 0;
  }

  /**
   * Records a completed mutation with forward and inverse operations
   * @param {Object} forward - The mutation applied { type, entity, id, from, to }
   * @param {Object} inverse - The exact reverse mutation to restore previous state
   * @param {string} [description='Mutation']
   */
  push(forward, inverse, description = 'Mutation') {
    // New action invalidates any forward redo stack
    this.redoStack = [];

    const entry = {
      forward,
      inverse,
      description,
      timestamp: Date.now(),
    };

    this.undoStack.push(entry);
    this.currentIndex++;

    // Enforce 100 step ceiling
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
      // Adjust saved index if it shifts off stack
      if (this.savedIndex > 0) {
        this.savedIndex--;
      }
    }
  }

  /**
   * Performs an undo action
   * @param {Function} applyInverseCallback - Invoked with entry.inverse
   * @returns {Object|null} The undone entry or null if stack is empty
   */
  undo(applyInverseCallback) {
    if (!this.canUndo()) return null;

    const entry = this.undoStack.pop();
    this.redoStack.push(entry);
    this.currentIndex--;

    if (typeof applyInverseCallback === 'function') {
      applyInverseCallback(entry.inverse);
    }

    return entry;
  }

  /**
   * Performs a redo action
   * @param {Function} applyForwardCallback - Invoked with entry.forward
   * @returns {Object|null} The redone entry or null if stack is empty
   */
  redo(applyForwardCallback) {
    if (!this.canRedo()) return null;

    const entry = this.redoStack.pop();
    this.undoStack.push(entry);
    this.currentIndex++;

    if (typeof applyForwardCallback === 'function') {
      applyForwardCallback(entry.forward);
    }

    return entry;
  }

  /**
   * Checks whether undo is possible
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Checks whether redo is possible
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Marks current stack position as the saved state (e.g. after successful HTTP save)
   */
  markSaved() {
    this.savedIndex = this.currentIndex;
  }

  /**
   * Checks whether there are unsaved local modifications
   * @returns {boolean}
   */
  isDirty() {
    return this.currentIndex !== this.savedIndex;
  }

  /**
   * Clears the entire history stack (e.g. upon loading fresh snapshot)
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.savedIndex = 0;
    this.currentIndex = 0;
  }

  /**
   * Returns current stack status for UI debugging / HUD display
   */
  getStatus() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      isDirty: this.isDirty(),
    };
  }
}
