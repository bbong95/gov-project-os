begin;

select plan(1);

select has_column(
	'auth',
	'users',
	'id',
	'local Supabase auth schema is available to the RLS test runner'
);

select * from finish();
rollback;
