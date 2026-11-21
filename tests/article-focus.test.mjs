import assert from "node:assert/strict";
import { test } from "node:test";
import { createArticleLoadController } from "../src/utils/article-load-state.js";

class FakeElement {
  constructor(document, { state, copy, parent } = {}) {
    this.ownerDocument = document;
    this.parentElement = parent || null;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.focusCount = 0;
    this.blurCount = 0;
    if (state) this.dataset.articleLoad = state;
    if (copy) this.dataset.articleLoadCopy = copy;
    if (parent) parent.children.push(this);
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      if (selector === "[data-article-load]" && element.dataset.articleLoad) matches.push(element);
      if (selector === '[data-article-load-copy="initial"]' && element.dataset.articleLoadCopy === "initial") matches.push(element);
      if (selector === '[data-article-load-copy="slow"]' && element.dataset.articleLoadCopy === "slow") matches.push(element);
      element.children.forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  contains(target) {
    return this === target || this.children.some((child) => child.contains(target));
  }

  focus(options) {
    this.focusCount += 1;
    this.lastFocusOptions = options;
    this.ownerDocument.activeElement = this;
  }

  blur() {
    this.blurCount += 1;
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }
}

function fixture() {
  const document = { activeElement: null };
  const articleBody = new FakeElement(document);
  const root = new FakeElement(document, { parent: articleBody });
  const content = new FakeElement(document, { parent: articleBody });
  const loading = new FakeElement(document, { state: "loading", parent: root });
  const initialCopy = new FakeElement(document, { copy: "initial", parent: loading });
  const slowCopy = new FakeElement(document, { copy: "slow", parent: loading });
  const error = new FakeElement(document, { state: "error", parent: root });
  const retry = new FakeElement(document, { parent: error });
  const notFound = new FakeElement(document, { state: "not-found", parent: root });
  return { document, root, content, loading, initialCopy, slowCopy, error, retry, notFound };
}

function hiddenAncestor(element) {
  let current = element;
  while (current) {
    if (current.hidden || current.attributes["aria-hidden"] === "true") return current;
    current = current.parentElement;
  }
  return null;
}

test("article state changes move focus out of hidden controls and into the new context", () => {
  const view = fixture();
  globalThis.document = view.document;
  globalThis.window = {
    clearTimeout,
    setTimeout,
    matchMedia: () => ({ matches: false }),
  };

  try {
    const controller = createArticleLoadController(view.root, view.content, { slowDelay: 100_000 });
    const initialToken = controller.begin();
    assert.equal(view.root.dataset.articleLoadCurrent, "loading");

    view.document.activeElement = view.retry;
    const retryToken = controller.begin();
    assert.equal(view.document.activeElement, view.loading);
    assert.equal(view.root.dataset.articleLoadCurrent, "loading");
    assert.equal(view.error.attributes["aria-hidden"], "true");
    assert.equal(view.loading.attributes["aria-hidden"], "false");
    assert.equal(hiddenAncestor(view.document.activeElement), null);

    assert.equal(controller.isCurrent(initialToken), false);
    assert.equal(controller.complete(retryToken), true);
    assert.equal(view.root.hidden, true);
    assert.equal(view.document.activeElement, view.content);
    assert.equal(view.content.hidden, false);

    const errorToken = controller.begin();
    assert.equal(view.document.activeElement, view.loading);
    assert.equal(controller.fail(errorToken), true);
    assert.equal(view.document.activeElement, view.error);
    assert.equal(view.content.hidden, true);
    assert.equal(view.loading.attributes["aria-hidden"], "true");
    assert.equal(view.error.attributes["aria-hidden"], "false");
    assert.equal(hiddenAncestor(view.document.activeElement), null);

    const notFoundToken = controller.begin();
    assert.equal(view.document.activeElement, view.loading);
    assert.equal(controller.notFound(notFoundToken), true);
    assert.equal(view.document.activeElement, view.notFound);
    assert.equal(view.content.hidden, true);
    assert.equal(view.notFound.attributes["aria-hidden"], "false");
    assert.equal(hiddenAncestor(view.document.activeElement), null);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});

test("article state changes preserve focus outside the loading state", () => {
  const view = fixture();
  const outside = new FakeElement(view.document);
  view.document.activeElement = outside;
  globalThis.document = view.document;
  globalThis.window = {
    clearTimeout,
    setTimeout,
    matchMedia: () => ({ matches: false }),
  };

  try {
    const controller = createArticleLoadController(view.root, view.content, { slowDelay: 100_000 });
    const token = controller.begin();
    assert.equal(view.document.activeElement, outside);
    assert.equal(controller.fail(token), true);
    assert.equal(view.document.activeElement, outside);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
