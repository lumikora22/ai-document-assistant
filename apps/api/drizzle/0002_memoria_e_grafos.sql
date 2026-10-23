CREATE TABLE "mensagens_conversa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"conteudo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"conversa_id" uuid NOT NULL,
	"resumo" text NOT NULL,
	"quantidade_mensagens" integer NOT NULL,
	"embedding" vector(384) NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memorias_conversa_id_unique" UNIQUE("conversa_id")
);
--> statement-breakpoint
CREATE TABLE "relacoes_memoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"origem_id" uuid NOT NULL,
	"destino_id" uuid NOT NULL,
	"rotulo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entidades_memoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"chave" text NOT NULL,
	"tipo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas_rag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"conversa_id" uuid NOT NULL,
	"pergunta" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas_rag_trechos" (
	"consulta_id" uuid NOT NULL,
	"trecho_id" uuid NOT NULL,
	"similaridade" real NOT NULL,
	CONSTRAINT "consultas_rag_trechos_consulta_id_trecho_id_pk" PRIMARY KEY("consulta_id","trecho_id")
);
--> statement-breakpoint
ALTER TABLE "mensagens_conversa" ADD CONSTRAINT "mensagens_conversa_conversa_id_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorias" ADD CONSTRAINT "memorias_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorias" ADD CONSTRAINT "memorias_conversa_id_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes_memoria" ADD CONSTRAINT "relacoes_memoria_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes_memoria" ADD CONSTRAINT "relacoes_memoria_origem_id_entidades_memoria_id_fk" FOREIGN KEY ("origem_id") REFERENCES "public"."entidades_memoria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes_memoria" ADD CONSTRAINT "relacoes_memoria_destino_id_entidades_memoria_id_fk" FOREIGN KEY ("destino_id") REFERENCES "public"."entidades_memoria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entidades_memoria" ADD CONSTRAINT "entidades_memoria_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_rag" ADD CONSTRAINT "consultas_rag_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_rag" ADD CONSTRAINT "consultas_rag_conversa_id_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_rag_trechos" ADD CONSTRAINT "consultas_rag_trechos_consulta_id_consultas_rag_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas_rag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_rag_trechos" ADD CONSTRAINT "consultas_rag_trechos_trecho_id_trechos_nota_id_fk" FOREIGN KEY ("trecho_id") REFERENCES "public"."trechos_nota"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mensagens_conversa_conversa_id" ON "mensagens_conversa" USING btree ("conversa_id");--> statement-breakpoint
CREATE INDEX "idx_conversas_nota_id" ON "conversas" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX "idx_memorias_nota_id" ON "memorias" USING btree ("nota_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_relacoes_memoria" ON "relacoes_memoria" USING btree ("origem_id","destino_id","rotulo");--> statement-breakpoint
CREATE INDEX "idx_relacoes_memoria_nota_id" ON "relacoes_memoria" USING btree ("nota_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entidades_memoria_nota_chave" ON "entidades_memoria" USING btree ("nota_id","chave");--> statement-breakpoint
CREATE INDEX "idx_consultas_rag_nota_id" ON "consultas_rag" USING btree ("nota_id");