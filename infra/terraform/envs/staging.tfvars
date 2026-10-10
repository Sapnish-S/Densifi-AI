env                 = "staging"
region              = "us-ord"
obj_region          = "us-ord"
obj_endpoint        = "us-ord-10.linodeobjects.com"
node_count          = 3
node_autoscaler_min = 3
node_autoscaler_max = 4
# TODO(🔎 VERIFY): shared 2 GB DB plan id for staging.
db_type         = "g6-nanode-1"
db_cluster_size = 1
domain          = "" # set to the Student Pack domain when claimed
manage_domain   = false
app_record_name = "app-staging"
api_record_name = "api-staging"
app_origins     = ["https://densify-ai-staging.vercel.app"]
deployment_mode = "vm"
