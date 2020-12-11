# Hook Middleware Decorators

Add and remove pre and post middleware hooks to class methods on a per class instance basis with the help of class and method decorators.

## How To Use

```typescript
import { Hooks, Hook, HookAsync hasHooks } from 'hook-decorator-middleware'

@Hooks()
class ClassWithHooks {
	@Hook()
	hello(person: string) {
		const message =  `Hello ${person}`;
		console.log(message);
		return message;
	}

	@HookAsync()
	async helloAsync(person: string) {
		const message =   `Hello ${person} async`;
		console.log(message);
		return message;
	}

	noHook(person: string) {
		const message = `No hook called with ${person}`
		console.log(message);
		return message;
	}
}

function preHello(person: string){
	console.log('pre', person)
}

function postHello(message: string, person: string){
	console.log('post', message, person)
}

const instance = new ClassWithHooks();
let helloUnsubscriber = () => {}
if(hasHooks<ClassWithHooks>(instance)) { // type-guard to ensure the class is decorated with @Hooks
	helloUnsubscriber = instance.pre('hello', preHello);
	instance.post('hello', postHello);
	instance.pre('helloAsync', preHello);
	instance.post('helloAsync', postHello);
	instance.pre('noHook', preHello);
	instance.post('noHook', postHello);
}

(async () => {
	instance.hello('world');
	await instance.helloAsync('Earth');
	instance.noHook('stuff')
	helloUnsubscriber();
	instance.hello('Mars');
})();

/**
 * Result:
 *
 * pre, world
 * Hello world
 * post, Hello world, world
 * pre, Earth
 * Hello Earth async
 * post, Hello Earth async, Earth
 * No hook called with stuff
 * Hello Mars
 */
```

## Important

The `@Hooks` class decorator adds `pre` and `post` methods to the decorated class. Any methods or properties with the same names in the class definition will be overridden.

If a `pre` function throws an error, the hooked method will throw the error as well. If a `post` function throws an error, the hooked method will not throw the error.

Registering a `pre` or `post` function will result in an unsubscriber being returned. Invoking the unsubscriber will remove the function as a middleware.

## Use Cases

1. Put authorization and validation in `pre` functions
2. Put metrics in `pre` and `post` functions where applicable
3. Put any side effects such as notifications in `post` functions

## Best Practices

1. Pre and post functions should refrain from mutating any arguments in order to keep behavior predictable.
2. Use the `@Hook` decorator for synchronous methods. Make sure middleware functions for synchronous methods are also synchronous.
3. Use the `@HookAsync` decorator for asynchronous methods. Middleware functions for asynchronous methods can be synchronous or asynchronous. 

## Similar Packages

### [hooks](https://www.npmjs.com/package/hooks)

### [Middlewarify](https://www.npmjs.com/package/middlewarify)

### [Sweet Decorators Lib](https://www.npmjs.com/package/sweet-decorators)

### [@feathersjs/hooks](https://www.npmjs.com/package/@feathersjs/hooks)
