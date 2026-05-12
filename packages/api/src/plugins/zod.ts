import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

interface CompilerSettable {
  setValidatorCompiler: (c: typeof validatorCompiler) => unknown;
  setSerializerCompiler: (c: typeof serializerCompiler) => unknown;
}

export function registerZod(app: CompilerSettable): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}
