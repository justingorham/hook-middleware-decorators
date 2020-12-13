/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
const HooksConfigurationSymbol = Symbol.for('HooksConfiguration');
const HooksCollectionSymbol = Symbol.for('HooksCollection');

export type PreHook<T> = T extends (...args: any[]) => any
  ? (...params: Parameters<T>) => any
  : never;

export type PostHook<T> = T extends (...args: any[]) => Promise<infer U>
  ? (returnVal: U, ...args: Parameters<T>) => any
  : T extends (...args: any[]) => any
  ? (returnVal: ReturnType<T>, ...args: Parameters<T>) => any
  : never;

export type AroundHook<T> = T extends (...args: any[]) => any
  ? (func: T, ...args: Parameters<T>) => ReturnType<T>
  : never;

export type UnregisterFunc = () => void;

type NonHookProps<T> = Omit<T, 'pre' | 'post' | 'around'>;

export interface IHooksRegistration<T> {
  pre<TKey extends keyof NonHookProps<T>>(
    p: TKey,
    func: PreHook<T[TKey]>
  ): UnregisterFunc;

  post<TKey extends keyof NonHookProps<T>>(
    p: TKey,
    func: PostHook<T[TKey]>
  ): UnregisterFunc;

  around<TKey extends keyof NonHookProps<T>>(
    p: TKey,
    func: AroundHook<T[TKey]>
  ): UnregisterFunc;
}

interface IHookInstance {
  type: 'pre' | 'post' | 'around';
  func: (...args: any[]) => any;
}

type HookCollection<T> = {
  [k in keyof NonHookProps<T>]?: IHookInstance[];
};

interface IHooks<T> extends IHooksRegistration<T> {
  [HooksCollectionSymbol]: HookCollection<T>;
  [HooksConfigurationSymbol]: HooksConfiguration;
}

export interface HooksConfiguration {
  logPostFunctionErrors: boolean;
  logger: (...args: any[]) => void;
  reduce: 'left' | 'right';
}

const defaultHooksConfiguration: HooksConfiguration = {
  logPostFunctionErrors: true,
  logger: (...args: any[]) => {
    console.error(...args);
  },
  reduce: 'right',
};

export function Hooks(config?: Partial<HooksConfiguration>) {
  return function<T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor implements IHooks<T> {
      readonly [HooksConfigurationSymbol]: HooksConfiguration = {
        ...defaultHooksConfiguration,
        ...config,
      };

      [HooksCollectionSymbol]: HookCollection<T> = {};

      pre<TKey extends keyof NonHookProps<T>>(
        p: TKey,
        func: PreHook<T[TKey]>
      ): UnregisterFunc {
        const col = this[HooksCollectionSymbol][p] ?? [];
        const instance: IHookInstance = { type: 'pre', func };
        this[HooksCollectionSymbol] = {
          ...this[HooksCollectionSymbol],
          [p]: [...col, instance],
        };
        return () => {
          this[HooksCollectionSymbol] = {
            ...this[HooksCollectionSymbol],
            [p]: (this[HooksCollectionSymbol][p] as IHookInstance[]).filter(
              i => i !== instance
            ),
          };
        };
      }

      post<TKey extends keyof NonHookProps<T>>(
        p: TKey,
        func: PostHook<T[TKey]>
      ): UnregisterFunc {
        const col = this[HooksCollectionSymbol][p] ?? [];
        const instance: IHookInstance = { type: 'post', func };
        this[HooksCollectionSymbol] = {
          ...this[HooksCollectionSymbol],
          [p]: [...col, instance],
        };
        return () => {
          this[HooksCollectionSymbol] = {
            ...this[HooksCollectionSymbol],
            [p]: (this[HooksCollectionSymbol][p] as IHookInstance[]).filter(
              i => i !== instance
            ),
          };
        };
      }

      around<TKey extends keyof NonHookProps<T>>(
        p: TKey,
        func: AroundHook<T[TKey]>
      ): UnregisterFunc {
        const col = this[HooksCollectionSymbol][p] ?? [];
        const instance: IHookInstance = { type: 'around', func };
        this[HooksCollectionSymbol] = {
          ...this[HooksCollectionSymbol],
          [p]: [...col, instance],
        };
        return () => {
          this[HooksCollectionSymbol] = {
            ...this[HooksCollectionSymbol],
            [p]: (this[HooksCollectionSymbol][p] as IHookInstance[]).filter(
              i => i !== instance
            ),
          };
        };
      }
    };
  };
}

export function hasHooks<T>(obj: any): obj is IHooksRegistration<T> {
  return obj[HooksConfigurationSymbol] !== undefined;
}

function hasHooksInternal<T>(obj: any): obj is IHooks<T> {
  return obj[HooksConfigurationSymbol] !== undefined;
}

export function HookAsync(): any {
  return function(
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalFunc: (...args: any[]) => Promise<any> = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const context = this;
      if (!hasHooksInternal<any>(context)) {
        return await Promise.resolve(originalFunc.apply(context, args));
      }

      const middlewares = context[HooksCollectionSymbol][propertyKey] || [];
      const reduce = (context[HooksConfigurationSymbol].reduce === 'left'
        ? middlewares.reduce
        : middlewares.reduceRight
      ).bind(middlewares);
      const hooked = reduce((acc, curr) => {
        switch (curr.type) {
          case 'pre':
            return async (...ars: any[]) => {
              await Promise.resolve(curr.func.apply(context, ars));
              return await acc.apply(context, ars);
            };
          case 'post':
            return async (...ars: any[]) => {
              const result = await acc.apply(context, ars);
              await Promise.resolve()
                .then(() => curr.func.apply(context, [result, ...ars]))
                .catch(err => {
                  if (context[HooksConfigurationSymbol].logPostFunctionErrors) {
                    context[HooksConfigurationSymbol].logger(err);
                  }
                });
              return result;
            };
          case 'around':
            return async (...ars: any[]) =>
              await curr.func.apply(context, [acc, ...ars]);
          default:
            return acc;
        }
      }, originalFunc.bind(context));

      return await hooked(...args);
    };
  };
}

export function Hook(): any {
  return function(
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalFunc = descriptor.value;
    descriptor.value = function(...args: any[]) {
      const context = this;
      if (!hasHooksInternal<any>(context)) {
        return originalFunc.apply(context, args);
      }

      const middlewares = context[HooksCollectionSymbol][propertyKey] || [];
      const reduce = (context[HooksConfigurationSymbol].reduce === 'left'
        ? middlewares.reduce
        : middlewares.reduceRight
      ).bind(middlewares);
      const hooked = reduce((acc, curr) => {
        switch (curr.type) {
          case 'pre':
            return (...ars: any[]) => {
              curr.func.apply(context, ars);
              return acc.apply(context, ars);
            };
          case 'post':
            return (...ars: any[]) => {
              const result = acc.apply(context, ars);
              try {
                curr.func.apply(context, [result, ...ars]);
              } catch (err) {
                if (context[HooksConfigurationSymbol].logPostFunctionErrors) {
                  context[HooksConfigurationSymbol].logger(err);
                }
              }
              return result;
            };
          case 'around':
            return (...ars: any[]) => curr.func.apply(context, [acc, ...ars]);
          default:
            return acc;
        }
      }, originalFunc.bind(context));

      return hooked(...args);
    };
  };
}
