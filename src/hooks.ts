/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
const HooksConfigurationSymbol = Symbol.for('HooksConfiguration');
const PreCollectionSymbol = Symbol.for('PreCollection');
const PostCollectionSymbol = Symbol.for('PostCollection');

export type PreHook<T> = T extends (...args: any[]) => any
  ? (...params: Parameters<T>) => any
  : never;

export type PostHook<T> = T extends (...args: any[]) => Promise<infer U>
  ? (returnVal: U, ...args: Parameters<T>) => any
  : T extends (...args: any[]) => any
  ? (returnVal: ReturnType<T>, ...args: Parameters<T>) => any
  : never;

export type UnregisterFunc = () => void;

type NonHookProps<T> = Omit<T, 'pre' | 'post'>;

export interface IHooksRegistration<T> {
  pre<TKey extends keyof NonHookProps<T>>(
    p: TKey,
    func: PreHook<T[TKey]>
  ): UnregisterFunc;

  post<TKey extends keyof NonHookProps<T>>(
    p: TKey,
    func: PostHook<T[TKey]>
  ): UnregisterFunc;
}

type HookCollection<T> = {
  [k in keyof NonHookProps<T>]?: ((...args: any[]) => any)[];
};

interface IHooks<T> extends IHooksRegistration<T> {
  [PreCollectionSymbol]: HookCollection<T>;
  [PostCollectionSymbol]: HookCollection<T>;
  [HooksConfigurationSymbol]: HooksConfiguration;
}

export interface HooksConfiguration {
  logPostFunctionErrors: boolean;
  logger: (...args: any[]) => void;
}

const defaultHooksConfiguration: HooksConfiguration = {
  logPostFunctionErrors: true,
  logger: (...args: any[]) => {
    console.error(...args);
  },
};

export function Hooks(config?: Partial<HooksConfiguration>) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor implements IHooks<T> {
      readonly [HooksConfigurationSymbol]: HooksConfiguration = {
        ...defaultHooksConfiguration,
        ...config,
      };
      [PreCollectionSymbol]: HookCollection<T> = {};
      [PostCollectionSymbol]: HookCollection<T> = {};

      pre<TKey extends keyof NonHookProps<T>>(
        p: TKey,
        func: PreHook<T[TKey]>
      ): UnregisterFunc {
        const col = this[PreCollectionSymbol][p] || [];
        this[PreCollectionSymbol] = {
          ...this[PreCollectionSymbol],
          [p]: [...col, func],
        };
        return () => {
          this[PreCollectionSymbol] = {
            ...this[PreCollectionSymbol],
            [p]: this[PreCollectionSymbol][p].filter((f) => f !== func),
          };
        };
      }

      post<TKey extends keyof NonHookProps<T>>(
        p: TKey,
        func: PostHook<T[TKey]>
      ): UnregisterFunc {
        const col = this[PostCollectionSymbol][p] || [];
        this[PostCollectionSymbol] = {
          ...this[PostCollectionSymbol],
          [p]: [...col, func],
        };
        return () => {
          this[PostCollectionSymbol] = {
            ...this[PostCollectionSymbol],
            [p]: this[PostCollectionSymbol][p].filter((f) => f !== func),
          };
        };
      }
    };
  };
}

export function hasHooks<T>(obj: unknown): obj is IHooksRegistration<T> {
  return obj[HooksConfigurationSymbol] !== undefined;
}

function hasHooksInternal<T>(obj: unknown): obj is IHooks<T> {
  return obj[HooksConfigurationSymbol] !== undefined;
}

export function HookAsync() {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalFunc = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const context = this;
      if (hasHooksInternal(context)) {
        const preFuncs = (context[PreCollectionSymbol][propertyKey] || []) as ((
          ...a: any[]
        ) => any)[];

        const pre = () =>
          Promise.all(
            preFuncs.map((func) => Promise.resolve(func.apply(context, args)))
          );

        const postFuncs = (context[PostCollectionSymbol][propertyKey] ||
          []) as ((...a: any[]) => any)[];

        const post = (r?: any) =>
          Promise.all(
            postFuncs.map((func) =>
              Promise.resolve()
                .then(() => func.apply(context, [r, ...args]))
                .catch((err) => {
                  if (context[HooksConfigurationSymbol].logPostFunctionErrors) {
                    context[HooksConfigurationSymbol].logger(err);
                  }
                })
            )
          );

        await pre();
        const result = await originalFunc.apply(context, args);
        await post(result);
        return result;
      }
      return await Promise.resolve(originalFunc.apply(context, args));
    };
  };
}

export function Hook() {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalFunc = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const context = this;
      if (hasHooksInternal(context)) {
        const preFuncs = (context[PreCollectionSymbol][propertyKey] || []) as ((
          ...a: any[]
        ) => any)[];

        const pre = () => preFuncs.forEach((func) => func.apply(context, args));

        const postFuncs = (context[PostCollectionSymbol][propertyKey] ||
          []) as ((...a: any[]) => any)[];

        const post = (r?: any) =>
          postFuncs.forEach((func) => {
            try {
              func.apply(context, [r, ...args]);
            } catch (err) {
              if (context[HooksConfigurationSymbol].logPostFunctionErrors) {
                context[HooksConfigurationSymbol].logger(err);
              }
            }
          });

        pre();
        const result = originalFunc.apply(context, args);
        post(result);
        return result;
      }
      return originalFunc.apply(context, args);
    };
  };
}
