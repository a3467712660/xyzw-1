import assert from "node:assert/strict";
import test from "node:test";
import {
  captureScrollPositions,
  restoreScrollPositions,
} from "../../src/utils/scrollPositionKeeper.js";

test("scroll position keeper restores window, document, body and nested scroll containers", () => {
  const scrollCalls = [];
  const windowRef = {
    pageXOffset: 17,
    pageYOffset: 230,
    scrollTo(arg0, arg1) {
      scrollCalls.push([arg0, arg1]);
      if (typeof arg0 === "object") {
        this.pageXOffset = arg0.left;
        this.pageYOffset = arg0.top;
      } else {
        this.pageXOffset = arg0;
        this.pageYOffset = arg1;
      }
    },
  };
  const documentElement = {
    scrollLeft: 4,
    scrollTop: 320,
  };
  const body = {
    scrollLeft: 2,
    scrollTop: 180,
  };
  const nested = {
    scrollLeft: 11,
    scrollTop: 420,
  };

  const snapshot = captureScrollPositions({
    candidates: [nested],
    documentRef: { body, documentElement },
    windowRef,
  });

  windowRef.pageXOffset = 0;
  windowRef.pageYOffset = 0;
  documentElement.scrollLeft = 0;
  documentElement.scrollTop = 0;
  body.scrollLeft = 0;
  body.scrollTop = 0;
  nested.scrollLeft = 0;
  nested.scrollTop = 0;

  restoreScrollPositions(snapshot);

  assert.deepEqual(scrollCalls.at(-1), [{ behavior: "auto", left: 17, top: 230 }, undefined]);
  assert.equal(documentElement.scrollTop, 320);
  assert.equal(documentElement.scrollLeft, 4);
  assert.equal(body.scrollTop, 180);
  assert.equal(body.scrollLeft, 2);
  assert.equal(nested.scrollTop, 420);
  assert.equal(nested.scrollLeft, 11);
});
