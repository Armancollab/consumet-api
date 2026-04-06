export type ProviderInstance = {
  name?: string;
  [key: string]: unknown;
};

export interface RegisteredProvider {
  instance: ProviderInstance;
  key: string;
  methods: string[];
  name: string;
}

type ProviderConstructor = new (...args: never[]) => ProviderInstance;

const isProviderConstructor = (value: unknown): value is ProviderConstructor =>
  typeof value === 'function';

const isPublicProviderMethod = (name: string, value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function' &&
  name !== 'constructor' &&
  !name.startsWith('_') &&
  (name === 'search' ||
    name === 'advancedSearch' ||
    name === 'genreSearch' ||
    name.endsWith('Search') ||
    name.startsWith('fetch'));

export const toSlug = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const getProviderMethods = (provider: ProviderInstance): string[] => {
  const methods = new Set<string>();
  let current: object | null = provider;

  while (current && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) {
      const value = provider[key];

      if (isPublicProviderMethod(key, value)) {
        methods.add(key);
      }
    }

    current = Object.getPrototypeOf(current);
  }

  return Array.from(methods).sort((left, right) => left.localeCompare(right));
};

export const buildProviderRegistry = (
  namespace: Record<string, unknown>
): Record<string, RegisteredProvider> =>
  Object.entries(namespace)
    .filter(([, value]) => isProviderConstructor(value))
    .reduce<Record<string, RegisteredProvider>>((registry, [exportName, Provider]) => {
      const ProviderClass = Provider as ProviderConstructor;
      const instance = new ProviderClass();
      const name = typeof instance.name === 'string' && instance.name.length > 0 ? instance.name : exportName;
      const key = toSlug(name);

      registry[key] = {
        instance,
        key,
        methods: getProviderMethods(instance),
        name,
      };

      return registry;
    }, {});

const coerceArgumentValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return trimmed;
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed === 'null') {
    return null;
  }

  const parsedNumber = Number(trimmed);

  if (!Number.isNaN(parsedNumber) && trimmed !== '') {
    return parsedNumber;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
};

export const parseArgs = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value.map(coerceArgumentValue);
  }

  if (value === undefined) {
    return [];
  }

  const parsed = coerceArgumentValue(value);

  return Array.isArray(parsed) ? parsed : [parsed];
};

export const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
};

export const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsedNumber = Number(value);

  return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
};

export const invokeProviderMethod = async (
  provider: RegisteredProvider,
  methodName: string,
  args: unknown[] = []
): Promise<unknown> => {
  const method = provider.instance[methodName];

  if (typeof method !== 'function') {
    throw new Error(`Method ${methodName} is not available on ${provider.name}.`);
  }

  return await method.apply(provider.instance, args);
};
