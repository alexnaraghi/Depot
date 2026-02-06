use std::collections::HashMap;

use super::parsing::*;

#[test]
fn test_parse_ztag_records_single_record() {
    let input = r#"... key1 value1
... key2 value2
... key3 value3
"#;
    let records = parse_ztag_records(input);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].get("key1"), Some(&"value1".to_string()));
    assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
    assert_eq!(records[0].get("key3"), Some(&"value3".to_string()));
}

#[test]
fn test_parse_ztag_records_multiple_records() {
    let input = r#"... key1 value1
... key2 value2

... key1 value3
... key2 value4
"#;
    let records = parse_ztag_records(input);
    assert_eq!(records.len(), 2);
    assert_eq!(records[0].get("key1"), Some(&"value1".to_string()));
    assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
    assert_eq!(records[1].get("key1"), Some(&"value3".to_string()));
    assert_eq!(records[1].get("key2"), Some(&"value4".to_string()));
}

#[test]
fn test_parse_ztag_records_empty_value() {
    let input = r#"... key1
... key2 value2
"#;
    let records = parse_ztag_records(input);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].get("key1"), Some(&"".to_string()));
    assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
}

#[test]
fn test_parse_ztag_records_value_with_spaces() {
    let input = r#"... desc This is a description with spaces
... user john_doe
"#;
    let records = parse_ztag_records(input);
    assert_eq!(records.len(), 1);
    assert_eq!(
        records[0].get("desc"),
        Some(&"This is a description with spaces".to_string())
    );
    assert_eq!(records[0].get("user"), Some(&"john_doe".to_string()));
}

#[test]
fn test_parse_ztag_records_empty_input() {
    let input = "";
    let records = parse_ztag_records(input);
    assert_eq!(records.len(), 0);
}

#[test]
fn test_parse_ztag_info() {
    let input = r#"... clientName my_workspace
... clientRoot C:\workspace
... clientStream //depot/main
... userName john_doe
... serverAddress perforce:1666
"#;
    let result = parse_ztag_info(input);
    assert!(result.is_ok());
    let info = result.unwrap();
    assert_eq!(info.client_name, "my_workspace");
    assert_eq!(info.client_root, "C:\\workspace");
    assert_eq!(info.client_stream, Some("//depot/main".to_string()));
    assert_eq!(info.user_name, "john_doe");
    assert_eq!(info.server_address, "perforce:1666");
}

#[test]
fn test_parse_ztag_info_missing_client_root() {
    let input = r#"... clientName my_workspace
... userName john_doe
"#;
    let result = parse_ztag_info(input);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("client root"));
}

#[test]
fn test_parse_ztag_fstat_synced_file() {
    let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... headType text
... headAction edit
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].depot_path, "//depot/main/file.cpp");
    assert_eq!(files[0].local_path, "C:\\workspace\\file.cpp");
    assert_eq!(files[0].status, "synced");
    assert_eq!(files[0].revision, 5);
    assert_eq!(files[0].head_revision, 5);
    assert_eq!(files[0].action, None);
}

#[test]
fn test_parse_ztag_fstat_checked_out_file() {
    let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... headType text
... action edit
... change 12345
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].depot_path, "//depot/main/file.cpp");
    assert_eq!(files[0].status, "checkedOut");
    assert_eq!(files[0].action, Some("edit".to_string()));
    assert_eq!(files[0].changelist, Some(12345));
}

#[test]
fn test_parse_ztag_fstat_added_file() {
    let input = r#"... depotFile //depot/main/newfile.cpp
... clientFile //my_workspace/newfile.cpp
... headRev 0
... haveRev 0
... action add
... change default
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].status, "added");
    assert_eq!(files[0].action, Some("add".to_string()));
}

#[test]
fn test_parse_ztag_fstat_out_of_date_file() {
    let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 10
... haveRev 5
... headType text
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].status, "outOfDate");
    assert_eq!(files[0].revision, 5);
    assert_eq!(files[0].head_revision, 10);
}

#[test]
fn test_parse_ztag_fstat_deleted_file() {
    let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... action delete
... change 12345
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].status, "deleted");
    assert_eq!(files[0].action, Some("delete".to_string()));
}

#[test]
fn test_parse_ztag_fstat_multiple_files() {
    let input = r#"... depotFile //depot/main/file1.cpp
... path C:\workspace\file1.cpp
... headRev 5
... haveRev 5
... headType text

... depotFile //depot/main/file2.cpp
... path C:\workspace\file2.cpp
... headRev 3
... haveRev 3
... headType text
... action edit
... change 12345
"#;
    let result = parse_ztag_fstat(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 2);
    assert_eq!(files[0].depot_path, "//depot/main/file1.cpp");
    assert_eq!(files[0].status, "synced");
    assert_eq!(files[1].depot_path, "//depot/main/file2.cpp");
    assert_eq!(files[1].status, "checkedOut");
}

#[test]
fn test_parse_ztag_changes() {
    let input = r#"... change 12345
... user john_doe
... client my_workspace
... status pending
... desc WIP: feature implementation
... time 1704067200

... change 12344
... user jane_smith
... client her_workspace
... status submitted
... desc Fixed bug in parser
... time 1704063600
"#;
    let result = parse_ztag_changes(input);
    assert!(result.is_ok());
    let changelists = result.unwrap();
    assert_eq!(changelists.len(), 2);

    assert_eq!(changelists[0].id, 12345);
    assert_eq!(changelists[0].user, "john_doe");
    assert_eq!(changelists[0].client, "my_workspace");
    assert_eq!(changelists[0].status, "pending");
    assert_eq!(changelists[0].description, "WIP: feature implementation");
    assert_eq!(changelists[0].time, 1704067200);
    assert_eq!(changelists[0].file_count, 0); // Default value

    assert_eq!(changelists[1].id, 12344);
    assert_eq!(changelists[1].user, "jane_smith");
    assert_eq!(changelists[1].status, "submitted");
}

#[test]
fn test_parse_ztag_changes_empty_description() {
    let input = r#"... change 12345
... user john_doe
... client my_workspace
... status pending
... time 1704067200
"#;
    let result = parse_ztag_changes(input);
    assert!(result.is_ok());
    let changelists = result.unwrap();
    assert_eq!(changelists.len(), 1);
    assert_eq!(changelists[0].description, "");
}

#[test]
fn test_parse_ztag_filelog_single_revision() {
    let input = r#"... rev0 5
... change0 12345
... action0 edit
... type0 text
... time0 1704067200
... user0 john_doe
... client0 my_workspace
... desc0 Fixed bug in parser
"#;
    let result = parse_ztag_filelog(input);
    assert!(result.is_ok());
    let revisions = result.unwrap();
    assert_eq!(revisions.len(), 1);

    assert_eq!(revisions[0].rev, 5);
    assert_eq!(revisions[0].change, 12345);
    assert_eq!(revisions[0].action, "edit");
    assert_eq!(revisions[0].file_type, "text");
    assert_eq!(revisions[0].time, 1704067200);
    assert_eq!(revisions[0].user, "john_doe");
    assert_eq!(revisions[0].client, "my_workspace");
    assert_eq!(revisions[0].desc, "Fixed bug in parser");
}

#[test]
fn test_parse_ztag_filelog_multiple_revisions() {
    let input = r#"... rev0 5
... change0 12345
... action0 edit
... type0 text
... time0 1704067200
... user0 john_doe
... client0 my_workspace
... desc0 Recent change
... rev1 4
... change1 12340
... action1 edit
... type1 text
... time1 1704063600
... user1 jane_smith
... client1 her_workspace
... desc1 Previous change
... rev2 3
... change2 12330
... action2 add
... type2 text
... time2 1704060000
... user2 john_doe
... client2 my_workspace
... desc2 Initial version
"#;
    let result = parse_ztag_filelog(input);
    assert!(result.is_ok());
    let revisions = result.unwrap();
    assert_eq!(revisions.len(), 3);

    assert_eq!(revisions[0].rev, 5);
    assert_eq!(revisions[0].change, 12345);
    assert_eq!(revisions[0].desc, "Recent change");

    assert_eq!(revisions[1].rev, 4);
    assert_eq!(revisions[1].change, 12340);
    assert_eq!(revisions[1].user, "jane_smith");

    assert_eq!(revisions[2].rev, 3);
    assert_eq!(revisions[2].change, 12330);
    assert_eq!(revisions[2].action, "add");
}

#[test]
fn test_parse_ztag_filelog_empty() {
    let input = "";
    let result = parse_ztag_filelog(input);
    assert!(result.is_ok());
    let revisions = result.unwrap();
    assert_eq!(revisions.len(), 0);
}

#[test]
fn test_parse_ztag_dirs() {
    let input = r#"... dir //depot/main/src

... dir //depot/main/include

... dir //depot/main/tests
"#;
    let result = parse_ztag_dirs(input);
    assert!(result.is_ok());
    let dirs = result.unwrap();
    assert_eq!(dirs.len(), 3);
    assert_eq!(dirs[0], "//depot/main/src");
    assert_eq!(dirs[1], "//depot/main/include");
    assert_eq!(dirs[2], "//depot/main/tests");
}

#[test]
fn test_parse_ztag_dirs_empty() {
    let input = "";
    let result = parse_ztag_dirs(input);
    assert!(result.is_ok());
    let dirs = result.unwrap();
    assert_eq!(dirs.len(), 0);
}

#[test]
fn test_build_file_info_missing_required_fields() {
    let mut fields = HashMap::new();
    fields.insert("depotFile".to_string(), "//depot/main/file.cpp".to_string());
    // Missing path/clientFile - should return None

    let result = build_file_info(&fields);
    assert!(result.is_none());
}

#[test]
fn test_build_changelist_missing_required_fields() {
    let mut fields = HashMap::new();
    fields.insert("change".to_string(), "12345".to_string());
    // Missing user - should return None

    let result = build_changelist(&fields);
    assert!(result.is_none());
}

#[test]
fn test_derive_file_status() {
    // Test checkedOut status for edit action
    assert_eq!(
        derive_file_status(&Some("edit".to_string()), 5, 5),
        "checkedOut"
    );

    // Test added status
    assert_eq!(
        derive_file_status(&Some("add".to_string()), 0, 0),
        "added"
    );

    // Test deleted status
    assert_eq!(
        derive_file_status(&Some("delete".to_string()), 5, 5),
        "deleted"
    );

    // Test notSynced status (have_rev = 0)
    assert_eq!(
        derive_file_status(&None, 0, 5),
        "notSynced"
    );

    // Test outOfDate status (have_rev < head_rev)
    assert_eq!(
        derive_file_status(&None, 3, 5),
        "outOfDate"
    );

    // Test synced status (up to date, not opened)
    assert_eq!(
        derive_file_status(&None, 5, 5),
        "synced"
    );

    // Test integrate action
    assert_eq!(
        derive_file_status(&Some("integrate".to_string()), 5, 5),
        "checkedOut"
    );

    // Test branch action
    assert_eq!(
        derive_file_status(&Some("branch".to_string()), 5, 5),
        "checkedOut"
    );
}

#[test]
fn test_parse_ztag_clients() {
    let input = r#"... client workspace1
... Root C:\workspace1
... Stream //depot/main
... Description My workspace

... client workspace2
... Root C:\workspace2
... Description Another workspace
"#;
    let result = parse_ztag_clients(input);
    assert!(result.is_ok());
    let workspaces = result.unwrap();
    assert_eq!(workspaces.len(), 2);

    assert_eq!(workspaces[0].name, "workspace1");
    assert_eq!(workspaces[0].root, "C:\\workspace1");
    assert_eq!(workspaces[0].stream, Some("//depot/main".to_string()));
    assert_eq!(workspaces[0].description, "My workspace");

    assert_eq!(workspaces[1].name, "workspace2");
    assert_eq!(workspaces[1].root, "C:\\workspace2");
    assert_eq!(workspaces[1].stream, None);
    assert_eq!(workspaces[1].description, "Another workspace");
}

#[test]
fn test_parse_ztag_describe_shelved() {
    let input = r#"... depotFile0 //depot/main/file1.cpp
... action0 edit
... type0 text
... rev0 5
... depotFile1 //depot/main/file2.cpp
... action1 add
... type1 text
... rev1 1
... depotFile2 //depot/main/file3.cpp
... action2 delete
... type2 text
... rev2 3
"#;
    let result = parse_ztag_describe_shelved(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 3);

    assert_eq!(files[0].depot_path, "//depot/main/file1.cpp");
    assert_eq!(files[0].action, "edit");
    assert_eq!(files[0].file_type, "text");
    assert_eq!(files[0].revision, 5);

    assert_eq!(files[1].depot_path, "//depot/main/file2.cpp");
    assert_eq!(files[1].action, "add");
    assert_eq!(files[1].revision, 1);

    assert_eq!(files[2].depot_path, "//depot/main/file3.cpp");
    assert_eq!(files[2].action, "delete");
    assert_eq!(files[2].revision, 3);
}

#[test]
fn test_parse_ztag_describe_shelved_with_metadata_split() {
    // Real p4 output: blank line in description causes record split
    let input = r#"... change 16
... user testuser
... client test-client
... time 1770178673
... desc New CL

... status pending
... changeType public
... shelved
... depotFile0 //streamsDepot/main/README.md
... action0 edit
... type0 text
... rev0 5
... fileSize0 39
... digest0 BE6588900FD5E04F0136C1872BE13DDD
"#;
    let result = parse_ztag_describe_shelved(input);
    assert!(result.is_ok());
    let files = result.unwrap();
    assert_eq!(files.len(), 1);

    assert_eq!(files[0].depot_path, "//streamsDepot/main/README.md");
    assert_eq!(files[0].action, "edit");
    assert_eq!(files[0].file_type, "text");
    assert_eq!(files[0].revision, 5);
}

#[test]
fn test_parse_ztag_streams() {
    let input = r#"... Stream //depot/main
... Name main
... Type mainline
... desc Main development stream

... Stream //depot/release
... Name release
... Parent //depot/main
... Type release
... desc Release stream
"#;
    let result = parse_ztag_streams(input);
    assert!(result.is_ok());
    let streams = result.unwrap();
    assert_eq!(streams.len(), 2);

    assert_eq!(streams[0].stream, "//depot/main");
    assert_eq!(streams[0].name, "main");
    assert_eq!(streams[0].stream_type, "mainline");
    assert_eq!(streams[0].parent, None);
    assert_eq!(streams[0].description, "Main development stream");

    assert_eq!(streams[1].stream, "//depot/release");
    assert_eq!(streams[1].name, "release");
    assert_eq!(streams[1].stream_type, "release");
    assert_eq!(streams[1].parent, Some("//depot/main".to_string()));
    assert_eq!(streams[1].description, "Release stream");
}

#[test]
fn test_parse_ztag_client_spec() {
    let input = r#"... Client my_workspace
... Root C:\workspace
... Stream //depot/main
... Owner john_doe
... Description My workspace for development
... Options noallwrite noclobber nocompress unlocked nomodtime normdir
... Host
... SubmitOptions submitunchanged
... View0 //depot/main/... //my_workspace/...
... View1 -//depot/main/exclude/... //my_workspace/exclude/...
"#;
    let result = parse_ztag_client_spec(input);
    assert!(result.is_ok());
    let spec = result.unwrap();

    assert_eq!(spec.client, "my_workspace");
    assert_eq!(spec.root, "C:\\workspace");
    assert_eq!(spec.stream, Some("//depot/main".to_string()));
    assert_eq!(spec.owner, "john_doe");
    assert_eq!(spec.description, "My workspace for development");
    assert_eq!(spec.options, "noallwrite noclobber nocompress unlocked nomodtime normdir");
    assert_eq!(spec.host, "");
    assert_eq!(spec.submit_options, "submitunchanged");
    assert_eq!(spec.view.len(), 2);
    assert_eq!(spec.view[0], "//depot/main/... //my_workspace/...");
    assert_eq!(spec.view[1], "-//depot/main/exclude/... //my_workspace/exclude/...");
}

#[test]
fn test_parse_ztag_depots() {
    let input = r#"... name depot
... type local

... name stream_depot
... Type stream

... name remote_depot
... type remote
"#;
    let result = parse_ztag_depots(input);
    assert!(result.is_ok());
    let depots = result.unwrap();
    assert_eq!(depots.len(), 3);

    assert_eq!(depots[0].name, "depot");
    assert_eq!(depots[0].depot_type, "local");

    assert_eq!(depots[1].name, "stream_depot");
    assert_eq!(depots[1].depot_type, "stream");

    assert_eq!(depots[2].name, "remote_depot");
    assert_eq!(depots[2].depot_type, "remote");
}

#[test]
fn test_parse_sync_line_updating() {
    let line = "//depot/main/file.cpp#5 - updating C:\\workspace\\file.cpp";
    let result = parse_sync_line(line);
    assert!(result.is_some());
    let progress = result.unwrap();
    assert_eq!(progress.depot_path, "//depot/main/file.cpp");
    assert_eq!(progress.revision, 5);
    assert_eq!(progress.action, "updating");
    assert!(!progress.is_conflict);
}

#[test]
fn test_parse_sync_line_adding() {
    let line = "//depot/main/newfile.cpp#1 - adding C:\\workspace\\newfile.cpp";
    let result = parse_sync_line(line);
    assert!(result.is_some());
    let progress = result.unwrap();
    assert_eq!(progress.depot_path, "//depot/main/newfile.cpp");
    assert_eq!(progress.revision, 1);
    assert_eq!(progress.action, "adding");
    assert!(!progress.is_conflict);
}

#[test]
fn test_parse_sync_line_deleting() {
    let line = "//depot/main/oldfile.cpp#3 - deleting C:\\workspace\\oldfile.cpp";
    let result = parse_sync_line(line);
    assert!(result.is_some());
    let progress = result.unwrap();
    assert_eq!(progress.depot_path, "//depot/main/oldfile.cpp");
    assert_eq!(progress.revision, 3);
    assert_eq!(progress.action, "deleting");
    assert!(!progress.is_conflict);
}

#[test]
fn test_parse_sync_line_conflict() {
    let line = "//depot/main/file.cpp#5 - can't clobber writable file C:\\workspace\\file.cpp";
    let result = parse_sync_line(line);
    assert!(result.is_some());
    let progress = result.unwrap();
    assert_eq!(progress.depot_path, "//depot/main/file.cpp");
    assert_eq!(progress.revision, 5);
    assert_eq!(progress.action, "can't clobber");
    assert!(progress.is_conflict);
}

#[test]
fn test_parse_sync_line_invalid() {
    let line = "invalid line without hash";
    let result = parse_sync_line(line);
    assert!(result.is_none());
}

#[test]
fn test_parse_reconcile_output() {
    let input = r#"C:\workspace\file1.cpp - opened for edit
//depot/main/file2.cpp#5 - opened for add
C:\workspace\file3.cpp - opened for delete
"#;
    let result = parse_reconcile_output(input);
    assert!(result.is_ok());
    let previews = result.unwrap();
    assert_eq!(previews.len(), 3);

    assert_eq!(previews[0].depot_path, "C:\\workspace\\file1.cpp");
    assert_eq!(previews[0].action, "edit");

    // Should strip revision specifier
    assert_eq!(previews[1].depot_path, "//depot/main/file2.cpp");
    assert_eq!(previews[1].action, "add");

    assert_eq!(previews[2].depot_path, "C:\\workspace\\file3.cpp");
    assert_eq!(previews[2].action, "delete");
}
