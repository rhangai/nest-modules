import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EntityRepositoryBase } from './entity-repository-base';
import { EntityServiceContext, EntityServiceTransactionContext } from './entity.context';

type RepositoryLikeConstructor<T extends EntityRepositoryBase<any>> = {
	new (entityManager: EntityManager): T;
};

const REPOSITORY_STORAGE = Symbol('repositories');

@Injectable()
export class EntityService {
	constructor(private readonly entityManagerInstance: EntityManager) {}

	/**
	 * Get the entity manager from the given context
	 * @param context
	 * @returns
	 */
	entityManager(context: EntityServiceContext | null | undefined): EntityManager {
		if (!context?.entityManager) return this.entityManagerInstance;
		return context.entityManager;
	}

	/**
	 * Get a repository from a given context
	 * @param context
	 * @returns The repository instance
	 */
	repository<T extends EntityRepositoryBase<any>>(
		context: EntityServiceContext | null | undefined,
		RepositoryClass: RepositoryLikeConstructor<T>
	): T {
		const entityManager = this.entityManager(context);

		let storage: Map<any, EntityRepositoryBase<any>>;
		if (REPOSITORY_STORAGE in entityManager) {
			storage = (entityManager as any)[REPOSITORY_STORAGE];
		} else {
			storage = new Map();
			Object.defineProperty(entityManager, REPOSITORY_STORAGE, {
				value: storage,
			});
		}

		let repository = storage.get(RepositoryClass) as T | undefined;
		if (!repository) {
			repository = new RepositoryClass(entityManager);
			storage.set(RepositoryClass, repository);
		}
		return repository;
	}

	/**
	 * Ensure a transaction
	 * @param context The transaction context
	 * @param callback The callback to be run inside the transaction
	 * @returns
	 */
	async transaction<R, C extends EntityServiceContext = EntityServiceContext>(
		context: C | null,
		callback: (context: EntityServiceTransactionContext<C>) => R | Promise<R>
	): Promise<R> {
		const entityManager = this.entityManager(context);
		if (entityManager.queryRunner?.isTransactionActive) {
			return callback({ ...context, entityManager } as any);
		}
		return entityManager.transaction(async (transactionEntityManager) =>
			callback({ ...context, entityManager: transactionEntityManager } as any)
		);
	}
}
