/* eslint-disable @typescript-eslint/no-empty-function */
import { hasHooks, Hook, HookAsync, Hooks } from './hooks';

describe('Hooks', () => {
  describe('hasHooks', () => {
    it('should be true for class with decorator', () => {
      @Hooks()
      class AClassWithHooks {}
      const instance = new AClassWithHooks();

      expect(hasHooks(instance)).toBeTruthy();
    });

    it('should be false for class without decorator', () => {
      class AClassWithoutHooks {}
      const instance = new AClassWithoutHooks();

      expect(hasHooks(instance)).toBeFalsy();
    });
  });

  describe('IHooksRegistration<T>', () => {
    @Hooks()
    class AClassWithHooks {
      async helloAsync(person: string) {
        return `Hello ${person}`;
      }

      hello(person: string) {
        return `Hello ${person} sync`;
      }
    }

    it('should register with no issues', () => {
      const instance = new AClassWithHooks();
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('helloAsync', (p: string) => {
          console.log(p);
        });
      }
    });

    it('should unregister with no issues', () => {
      const instance = new AClassWithHooks();
      const aFunc = (p: string) => {
        console.log(p);
      };
      if (hasHooks<AClassWithHooks>(instance)) {
        const unregister = instance.pre('helloAsync', aFunc);
        unregister();
      }
    });
  });

  describe('HookAsync', () => {
    @Hooks()
    class AClassWithHooks {
      @HookAsync()
      async hello(person: string) {
        return `Hello ${person}`;
      }
    }

    it('should call pre and post async hooks', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockResolvedValue(undefined);
      const post = jest.fn().mockResolvedValue(undefined);
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = await instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });

    it('should call pre and post sync hooks', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockReturnValue(undefined);
      const post = jest.fn().mockReturnValue(undefined);
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = await instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });

    it('should throw error when pre hook throws error sync', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn(() => {
        throw new Error('boom');
      });
      const post = jest.fn().mockReturnValue(undefined);
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      await expect(async () => await instance.hello('World')).rejects.toThrow(
        'boom'
      );
      expect(post).not.toHaveBeenCalled();
    });

    it('should throw error when pre hook throws error async', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockRejectedValue(new Error('boom'));
      const post = jest.fn().mockReturnValue(undefined);
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      await expect(async () => await instance.hello('World')).rejects.toThrow(
        'boom'
      );
      expect(post).not.toHaveBeenCalled();
    });

    it('should succeed when post hook throws async error', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockResolvedValue(undefined);
      const post = jest.fn().mockRejectedValue(new Error('boom'));
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = await instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });

    it('should succeed when post hook throws sync error', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockReturnValue(undefined);
      const post = jest.fn(() => {
        throw new Error('boom');
      });
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = await instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });
  });

  describe('Hook', () => {
    @Hooks()
    class AClassWithHooks {
      @Hook()
      hello(person: string) {
        return `Hello ${person}`;
      }
    }

    it('should call pre and post hooks', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn();
      const post = jest.fn();
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });

    it('should throw error when pre hook throws error', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn(() => {
        throw new Error('boom');
      });
      const post = jest.fn().mockReturnValue(undefined);
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      expect(() => instance.hello('World')).toThrow('boom');
      expect(post).not.toHaveBeenCalled();
    });

    it('should succeed when post hook throws error', async () => {
      const instance = new AClassWithHooks();
      const pre = jest.fn().mockReturnValue(undefined);
      const post = jest.fn(() => {
        throw new Error('boom');
      });
      if (hasHooks<AClassWithHooks>(instance)) {
        instance.pre('hello', pre);
        instance.post('hello', post);
      }
      const message = instance.hello('world');
      expect(message).toEqual('Hello world');
      expect(pre).toHaveBeenCalledWith('world');
      expect(post).toHaveBeenCalledWith('Hello world', 'world');
    });
  });

  describe('Unsubscribe', () => {
    @Hooks()
    class ClassWithHooks {
      @Hook()
      hello(person: string) {
        return `${person} caller`;
      }
    }
    it('should unsubscribe functions', () => {
      const instance = new ClassWithHooks();
      const spy = jest.fn();
      let unsubscribe = () => {};
      if (hasHooks<ClassWithHooks>(instance)) {
        unsubscribe = instance.pre('hello', spy);
      }
      instance.hello('yes');
      unsubscribe();
      instance.hello('no');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
