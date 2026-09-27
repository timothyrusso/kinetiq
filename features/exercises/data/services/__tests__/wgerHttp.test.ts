import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either, Fiber, Option } from 'effect';
import { itEffect } from '@/features/core/testing';
import { type FetchImpl, makeWgerGetJson } from '@/features/exercises/data/services/wgerHttp';

const URL = 'https://wger.test/api/v2/muscle/?limit=100';

type Answer = Response | 'offline' | 'hang';

/** A `fetch` that gives the answers in order, one per request, and counts the requests sent. */
const makeFetch = (answers: readonly Answer[]) => {
  const sent = { count: 0 };
  const fetchImpl: FetchImpl = (_url, init) => {
    const answer = answers[Math.min(sent.count, answers.length - 1)];
    sent.count += 1;
    if (answer === 'offline') return Promise.reject(new TypeError('Network request failed'));
    if (answer === 'hang' || answer === undefined) {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    }
    return Promise.resolve(answer.clone());
  };
  return { fetchImpl, sent };
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number, headers: Record<string, string> = {}) => new Response('{}', { status: code, headers });

describe('makeWgerGetJson', () => {
  const ok = makeFetch([json({ count: 1 })]);
  itEffect(
    'succeeds with the parsed body',
    Effect.gen(function* () {
      expect(yield* makeWgerGetJson(ok.fetchImpl)(URL)).toEqual({ count: 1 });
    }),
  );

  const limited = makeFetch([status(429, { 'Retry-After': '5' }), json({ count: 2 })]);
  itEffect(
    'retries a rate limit after the Retry-After the server sent',
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(makeWgerGetJson(limited.fetchImpl)(URL));

      yield* advanceClock('4999 millis');
      expect(Option.isNone(yield* Fiber.poll(fiber))).toBe(true);
      yield* advanceClock('1 millis');

      expect(yield* Fiber.join(fiber)).toEqual({ count: 2 });
    }),
  );

  const flooded = makeFetch([status(429), status(429), status(429), status(429), json({})]);
  itEffect(
    'gives up on a rate limit after three retries',
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(Effect.either(makeWgerGetJson(flooded.fetchImpl)(URL)));

      yield* advanceClock('1 minute');
      const result = yield* Fiber.join(fiber);

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'rate-limit' });
      expect(flooded.sent.count).toBe(4);
    }),
  );

  const failing = makeFetch([status(503), status(502), status(500), json({})]);
  itEffect(
    'gives up on a server error after two retries, backing off 300 then 600 ms',
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(Effect.either(makeWgerGetJson(failing.fetchImpl)(URL)));

      yield* advanceClock('899 millis');
      expect(Option.isNone(yield* Fiber.poll(fiber))).toBe(true);
      yield* advanceClock('1 millis');
      const result = yield* Fiber.join(fiber);

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'server', status: 500 });
      expect(failing.sent.count).toBe(3);
    }),
  );

  const missing = makeFetch([status(404), json({})]);
  itEffect(
    'never retries a request the server rejected',
    Effect.gen(function* () {
      const result = yield* Effect.either(makeWgerGetJson(missing.fetchImpl)(URL));

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'not-found' });
      expect(missing.sent.count).toBe(1);
    }),
  );

  const offline = makeFetch(['offline', json({})]);
  itEffect(
    'fails with OfflineError and never retries when the connection fails',
    Effect.gen(function* () {
      const result = yield* Effect.either(makeWgerGetJson(offline.fetchImpl)(URL));

      expect(Either.isLeft(result) && result.left._tag).toBe('OfflineError');
      expect(offline.sent.count).toBe(1);
    }),
  );

  const garbled = makeFetch([new Response('<html>', { status: 200 }), json({})]);
  itEffect(
    'fails with a parse HttpError for a body that is not JSON, without retrying',
    Effect.gen(function* () {
      const result = yield* Effect.either(makeWgerGetJson(garbled.fetchImpl)(URL));

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'parse' });
      expect(garbled.sent.count).toBe(1);
    }),
  );

  const silent = makeFetch(['hang']);
  itEffect(
    'times a request out after 60 seconds and retries it twice',
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(Effect.either(makeWgerGetJson(silent.fetchImpl)(URL)));

      yield* advanceClock('60 seconds');
      yield* advanceClock('300 millis');
      yield* advanceClock('60 seconds');
      yield* advanceClock('600 millis');
      expect(Option.isNone(yield* Fiber.poll(fiber))).toBe(true);
      yield* advanceClock('60 seconds');
      const result = yield* Fiber.join(fiber);

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'timeout' });
      expect(silent.sent.count).toBe(3);
    }),
  );
});
