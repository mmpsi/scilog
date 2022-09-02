import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, Entity, HasManyRepositoryFactory, juggler, Model, repository} from '@loopback/repository';
import {ACLRepository} from './acl.repository';

export class AutoAddRepository<
    T extends Entity,
    ID,
    Relations extends object = {}
    > extends DefaultCrudRepository<T, ID, Relations> {

    public readonly parent: BelongsToAccessor<
        Entity,
        any
    >;


    public readonly subsnippets: HasManyRepositoryFactory<
        T,
        string
    >;

    constructor(
        entityClass: typeof Entity & {
            prototype: T;
        },
        dataSource: juggler.DataSource,
        @repository(ACLRepository)
        public aclRepository: ACLRepository,
    ) {
        super(entityClass, dataSource)
        this.subsnippets = this.createHasManyRepositoryFactoryFor(
            'subsnippets',
            Getter.fromValue(this),
        );

        this.parent = this.createBelongsToAccessorFor(
            'parent',
            Getter.fromValue(this) ,
        );

        // add these lines to register inclusion resolver.
        this.registerInclusionResolver('subsnippets', this.subsnippets.inclusionResolver);
        this.registerInclusionResolver('parent', this.parent.inclusionResolver);
    }

    definePersistedModel(entityClass: typeof Model) {
        const modelClass = super.definePersistedModel(entityClass);
        modelClass.observe('before save', async ctx => {
            let currentUser: any;
            if (!ctx?.options.hasOwnProperty('currentUser')) {
                throw new Error("Unexpected user context: Current user cannot be retrieved.")
            } else {
                currentUser = ctx.options.currentUser;
            }
            // console.log(`going to save ${ctx.Model.modelName} ${ctx}`);
            // PATCH case
            if (ctx.data) {
                // console.error("PATCH case")
                ctx.data.updatedAt = new Date();
                ctx.data.updatedBy = currentUser?.email ?? 'unknown@domain.org';
            } else {
                if (ctx.isNewInstance) {
                    // POST case
                    // console.error("POST case")
                    ctx.instance.defaultOrder = ctx.instance.defaultOrder ?? Date.now() * 1000;
                // only admin may override createdAt/updateAt etc fields
                    if (currentUser.roles.includes('admin')){
                       ctx.instance.createdAt = ctx.instance.createdAt ?? new Date();                 
                       ctx.instance.createdBy = ctx.instance.createdBy ?? currentUser?.email ?? 'unknown@domain.org';
                       ctx.instance.updatedAt = ctx.instance.updatedAt ?? new Date();                 
                       ctx.instance.updatedBy = ctx.instance.updatedBy ?? currentUser?.email ?? 'unknown@domain.org';
                    } else {
                       ctx.instance.createdAt = new  Date();
                       ctx.instance.createdBy = currentUser?.email ?? 'unknown@domain.org';
                       ctx.instance.updatedAt = new Date();
                       ctx.instance.updatedBy = currentUser?.email ?? 'unknown@domain.org';
                    }
                    
                    if (typeof ctx.instance.expiresAt == 'undefined') {
                    // default expiration time is 3 days
                       ctx.instance.expiresAt = new Date()
                       ctx.instance.expiresAt.setDate(ctx.instance.expiresAt.getDate() + 3);
                    }

                    // TODO: if aclId is not defined take it from parent

                    // TODO: if aclId is provided check for existence


                } else {
                    // PUT case
                    // console.error("PUT case")
                    // TODO restore auto generated fields, which would otherwise be lost
                    // ctx.instance.unsetAttribute('id')
                }

            }
            //console.error("going to save:" + JSON.stringify(ctx, null, 3))

        });

        modelClass.observe('access', async ctx => {
            let currentUser: any;
            if (!ctx?.options.hasOwnProperty('currentUser')) {
                throw new Error("Unexpected user context: Current user cannot be retrieved.")
            } else {
                currentUser = ctx.options.currentUser;
            }
            console.log("current user:",currentUser)
            console.log("roles:", currentUser?.roles);
            // console.log("access case:", JSON.stringify(ctx, null, 3));
            // TODO move this calculation to login time
            let groups = [...ctx?.options?.currentUser?.roles]
            let acls=await this.aclRepository.find({where:{ read: {inq: ctx?.options?.currentUser?.roles}},fields:{id:true}})
            let readACLs=acls.map(item => item.id)
            console.log("acls:", readACLs);

            if (!groups.includes('admin')) {
                var groupCondition = {
                        aclId: {
                            inq: readACLs
                        }
                };
                if (!ctx.query.where) {
                    ctx.query.where = groupCondition;
                } else {
                    ctx.query.where = {
                        and: [ctx.query.where, groupCondition]
                    };
                }
            }
            console.log("query:",JSON.stringify(ctx.query,null,3));
        })
        return modelClass;
    }
}
